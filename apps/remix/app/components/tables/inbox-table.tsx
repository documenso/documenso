import { useMemo, useTransition } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { RecipientRole } from '@prisma/client';
import { CheckCircleIcon, EyeIcon, Loader, PencilIcon } from 'lucide-react';
import { DateTime } from 'luxon';
import { Link, useSearchParams } from 'react-router';
import { match } from 'ts-pattern';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';
import { trpc } from '@documenso/trpc/react';
import type { TFindDocumentsResponse } from '@documenso/trpc/server/document-router/schema';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';

import { useOptionalCurrentTeam } from '~/providers/team';

import { StackAvatarsWithTooltip } from '../general/stack-avatars-with-tooltip';

export type DocumentsTableProps = {
  data?: TFindDocumentsResponse;
  isLoading?: boolean;
  isLoadingError?: boolean;
};

type DocumentsTableRow = TFindDocumentsResponse['data'][number];

export const InboxTable = () => {
  const { _, i18n } = useLingui();

  const team = useOptionalCurrentTeam();
  const [isPending, startTransition] = useTransition();

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const page = searchParams?.get?.('page') ? Number(searchParams.get('page')) : undefined;
  const perPage = searchParams?.get?.('perPage') ? Number(searchParams.get('perPage')) : undefined;

  const { data, isLoading, isLoadingError } = trpc.document.findDocumentsInternal.useQuery({
    status: ExtendedDocumentStatus.INBOX,
    page: page || 1,
    perPage: perPage || 10,
  });

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
        cell: ({ row }) => (
          <Link
            to={`/sign/${row.original.recipients[0]?.token}`}
            title={row.original.title}
            className="block max-w-[10rem] truncate font-medium hover:underline md:max-w-[20rem]"
          >
            {row.original.title}
          </Link>
        ),
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
        header: _(msg`Actions`),
        cell: ({ row }) => (
          <div className="flex items-center gap-x-4">
            <Button className="w-32" asChild>
              <Link to={`/sign/${row.original.recipients[0]?.token}`}>
                {match(row.original.recipients[0]?.role)
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
          </div>
        ),
      },
    ] satisfies DataTableColumnDef<DocumentsTableRow>[];
  }, [team]);

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
              <Trans>Documents that require your attention will appear here</Trans>
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
