import { useMemo, useTransition } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DocumentStatus as DocumentStatusEnum } from '@prisma/client';
import { RecipientRole, SigningStatus } from '@prisma/client';
import {
  CheckCircleIcon,
  ClockIcon,
  DownloadIcon,
  EyeIcon,
  Loader,
  PencilIcon,
} from 'lucide-react';
import { DateTime } from 'luxon';
import { Link, useSearchParams } from 'react-router';
import { match } from 'ts-pattern';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { isDocumentCompleted } from '@documenso/lib/utils/document';
import { trpc } from '@documenso/trpc/react';
import type { TInboxFilter } from '@documenso/trpc/server/document-router/find-inbox.types';
import type { TFindInboxResponse } from '@documenso/trpc/server/document-router/find-inbox.types';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { DocumentStatus } from '~/components/general/document/document-status';
import { useOptionalCurrentTeam } from '~/providers/team';

import { EnvelopeDownloadDialog } from '../dialogs/envelope-download-dialog';
import { StackAvatarsWithTooltip } from '../general/stack-avatars-with-tooltip';

const parseInboxFilter = (value: string | null): TInboxFilter =>
  value === 'WAITING' ? 'WAITING' : 'ALL';

export type DocumentsTableProps = {
  data?: TFindInboxResponse;
  isLoading?: boolean;
  isLoadingError?: boolean;
};

type DocumentsTableRow = TFindInboxResponse['data'][number];

type InboxTurnStatus = 'YOUR_TURN' | 'WAITING_FOR_OTHERS' | 'NONE';

/**
 * Classify, from the signed-in user's perspective, whether a pending envelope is
 * waiting on them (`YOUR_TURN`), waiting on an earlier signer (`WAITING_FOR_OTHERS`),
 * or neither. `isWaitingForCurrentUser` is computed on the server using the signing
 * order; the "waiting for others" case is the remaining pending-but-not-yet-my-turn state.
 */
const getInboxTurnStatus = (row: DocumentsTableRow, userEmail: string): InboxTurnStatus => {
  if (row.isWaitingForCurrentUser) {
    return 'YOUR_TURN';
  }

  const recipient = row.recipients.find(
    (item) => item.email === userEmail && item.role !== RecipientRole.CC,
  );

  const isPendingSigner =
    row.status === DocumentStatusEnum.PENDING &&
    recipient?.signingStatus === SigningStatus.NOT_SIGNED &&
    (recipient.role === RecipientRole.SIGNER || recipient.role === RecipientRole.APPROVER);

  return isPendingSigner ? 'WAITING_FOR_OTHERS' : 'NONE';
};

export const InboxTable = () => {
  const { _, i18n } = useLingui();
  const { user } = useSession();

  const team = useOptionalCurrentTeam();
  const [isPending, startTransition] = useTransition();

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const page = searchParams?.get?.('page') ? Number(searchParams.get('page')) : undefined;
  const perPage = searchParams?.get?.('perPage') ? Number(searchParams.get('perPage')) : undefined;
  const filter = parseInboxFilter(searchParams?.get?.('filter') ?? null);

  const { data, isLoading, isLoadingError } = trpc.document.inbox.find.useQuery({
    page: page || 1,
    perPage: perPage || 10,
    filter,
  });

  const onFilterChange = (value: string) => {
    startTransition(() => {
      updateSearchParams({
        filter: value === 'ALL' ? null : value,
        page: 1,
      });
    });
  };

  const columns = useMemo(() => {
    return [
      {
        header: _(msg`Created`),
        accessorKey: 'createdAt',
        cell: ({ row }) =>
          i18n.date(row.original.createdAt, { ...DateTime.DATETIME_SHORT, hourCycle: 'h12' }),
      },
      {
        header: _(msg`Title`),
        cell: ({ row }) => {
          const turnStatus = getInboxTurnStatus(row.original, user.email);

          return (
            <div className="flex max-w-[10rem] flex-col gap-1 md:max-w-[20rem]">
              <span className="truncate font-medium">{row.original.title}</span>

              {turnStatus === 'YOUR_TURN' && (
                <Badge variant="secondary" size="small" className="w-fit">
                  <Trans>Your turn to sign</Trans>
                </Badge>
              )}

              {turnStatus === 'WAITING_FOR_OTHERS' && (
                <Badge variant="neutral" size="small" className="w-fit">
                  <Trans>Waiting for others</Trans>
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        id: 'sender',
        header: _(msg`Sender`),
        cell: ({ row }) => row.original.user.name ?? row.original.user.email,
      },
      {
        header: _(msg`Recipient`),
        accessorKey: 'recipient',
        cell: ({ row }) => (
          <StackAvatarsWithTooltip
            recipients={row.original.recipients}
            documentStatus={row.original.status}
          />
        ),
      },
      {
        header: _(msg`Status`),
        accessorKey: 'status',
        cell: ({ row }) => <DocumentStatus status={row.original.status} />,
        size: 140,
      },
      {
        header: _(msg`Actions`),
        cell: ({ row }) => <InboxTableActionButton row={row.original} />,
      },
    ] satisfies DataTableColumnDef<DocumentsTableRow>[];
  }, [team, user.email]);

  const onPaginationChange = (page: number, perPage: number) => {
    startTransition(() => {
      updateSearchParams({
        page,
        perPage,
      });
    });
  };

  const results = data ?? {
    data: [],
    perPage: 10,
    currentPage: 1,
    totalPages: 1,
  };

  return (
    <div className="relative">
      <Tabs value={filter} onValueChange={onFilterChange} className="mb-4 w-fit">
        <TabsList>
          <TabsTrigger value="ALL" className="hover:text-foreground">
            <Trans>All</Trans>
          </TabsTrigger>
          <TabsTrigger value="WAITING" className="hover:text-foreground">
            <Trans>Waiting for me</Trans>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        data={results.data}
        perPage={results.perPage}
        currentPage={results.currentPage}
        totalPages={results.totalPages}
        onPaginationChange={onPaginationChange}
        columnVisibility={{
          sender: team !== undefined,
        }}
        error={{
          enable: isLoadingError || false,
        }}
        emptyState={
          <div className="text-muted-foreground/60 flex h-60 flex-col items-center justify-center gap-y-4">
            <p>
              {filter === 'WAITING' ? (
                <Trans>No documents are waiting on you to sign right now</Trans>
              ) : (
                <Trans>Documents that require your attention will appear here</Trans>
              )}
            </p>
          </div>
        }
        skeleton={{
          enable: isLoading || false,
          rows: 5,
          component: (
            <>
              <TableCell>
                <Skeleton className="h-4 w-40 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20 rounded-full" />
              </TableCell>
              <TableCell className="py-4">
                <div className="flex w-full flex-row items-center">
                  <Skeleton className="h-10 w-10 flex-shrink-0 rounded-full" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-10 w-24 rounded" />
              </TableCell>
            </>
          ),
        }}
      >
        {(table) =>
          results.totalPages > 1 && (
            <DataTablePagination additionalInformation="VisibleCount" table={table} />
          )
        }
      </DataTable>

      {isPending && (
        <div className="bg-background/50 absolute inset-0 flex items-center justify-center">
          <Loader className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      )}
    </div>
  );
};

export type InboxTableActionButtonProps = {
  row: TFindInboxResponse['data'][number];
};

export const InboxTableActionButton = ({ row }: InboxTableActionButtonProps) => {
  const { user } = useSession();
  const { toast } = useToast();
  const { _ } = useLingui();

  const recipient = row.recipients.find((recipient) => recipient.email === user.email);

  const isPending = row.status === DocumentStatusEnum.PENDING;
  const isComplete = isDocumentCompleted(row.status);
  const isSigned = recipient?.signingStatus === SigningStatus.SIGNED;
  const role = recipient?.role;

  if (!recipient) {
    return null;
  }

  // TODO: Consider if want to keep this logic for hiding viewing for CC'ers
  if (recipient?.role === RecipientRole.CC && isComplete === false) {
    return null;
  }

  const isWaitingForOthers = getInboxTurnStatus(row, user.email) === 'WAITING_FOR_OTHERS';

  return match({
    isPending,
    isComplete,
    isSigned,
    isWaitingForOthers,
    internalVersion: row.internalVersion,
  })
    .with({ isPending: true, isSigned: false, isWaitingForOthers: true }, () => (
      <Button className="w-32" variant="secondary" disabled={true}>
        <ClockIcon className="-ml-1 mr-2 h-4 w-4" />
        <Trans>Waiting</Trans>
      </Button>
    ))
    .with({ isPending: true, isSigned: false }, () => (
      <Button className="w-32" asChild>
        <Link to={`/sign/${recipient?.token}`}>
          {match(role)
            .with(RecipientRole.SIGNER, () => (
              <>
                <PencilIcon className="-ml-1 mr-2 h-4 w-4" />
                <Trans>Sign</Trans>
              </>
            ))
            .with(RecipientRole.APPROVER, () => (
              <>
                <CheckCircleIcon className="-ml-1 mr-2 h-4 w-4" />
                <Trans>Approve</Trans>
              </>
            ))
            .otherwise(() => (
              <>
                <EyeIcon className="-ml-1 mr-2 h-4 w-4" />
                <Trans>View</Trans>
              </>
            ))}
        </Link>
      </Button>
    ))
    .with({ isPending: true, isSigned: true }, () => (
      <Button className="w-32" disabled={true}>
        <EyeIcon className="-ml-1 mr-2 h-4 w-4" />
        <Trans>View</Trans>
      </Button>
    ))
    .with({ isComplete: true }, () => (
      <EnvelopeDownloadDialog
        envelopeId={row.envelopeId}
        envelopeStatus={row.status}
        token={recipient?.token}
        trigger={
          <Button className="w-32">
            <DownloadIcon className="-ml-1 mr-2 inline h-4 w-4" />
            <Trans>Download</Trans>
          </Button>
        }
      />
    ))
    .otherwise(() => <div></div>);
};
