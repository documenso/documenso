import { useMemo, useTransition } from 'react';

import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Loader } from 'lucide-react';
import { DateTime } from 'luxon';
import { Link, useSearchParams } from 'react-router';
import { match } from 'ts-pattern';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { isDocumentCompleted } from '@documenso/lib/utils/document';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';
import type { TFindDocumentsInternalResponse } from '@documenso/trpc/server/document-router/schema';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { DataTable } from '@documenso/ui/primitives/data-table/data-table';
import {
  type TimePeriod,
  isDateInPeriod,
} from '@documenso/ui/primitives/data-table/utils/time-filters';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';

import { DocumentStatus } from '~/components/general/document/document-status';
import { StackAvatarsWithTooltip } from '~/components/general/stack-avatars-with-tooltip';
import { useOptionalCurrentTeam } from '~/providers/team';

import { DocumentsTableActionButton } from '../documents-table-action-button';
import { DocumentsTableActionDropdown } from '../documents-table-action-dropdown';
import { DocumentsTableEmptyState } from '../documents-table-empty-state';

export type DataTableProps = {
  data?: TFindDocumentsInternalResponse;
  isLoading?: boolean;
  isLoadingError?: boolean;
  onMoveDocument?: (documentId: number) => void;
};

type DocumentsTableRow = TFindDocumentsInternalResponse['data'][number];

export function DocumentsDataTable({
  data,
  isLoading,
  isLoadingError,
  onMoveDocument,
}: DataTableProps) {
  const { _ } = useLingui();
  const team = useOptionalCurrentTeam();
  const [isPending, startTransition] = useTransition();
  const updateSearchParams = useUpdateSearchParams();
  const [searchParams] = useSearchParams();

  const handleStatusFilterChange = (values: string[]) => {
    startTransition(() => {
      if (values.length === 0) {
        updateSearchParams({ status: undefined, page: undefined });
      } else {
        updateSearchParams({ status: values.join(','), page: undefined });
      }
    });
  };

  const currentStatus = searchParams.get('status');
  const selectedStatusValues = currentStatus ? currentStatus.split(',').filter(Boolean) : [];

  const handleResetFilters = () => {
    startTransition(() => {
      updateSearchParams({ status: undefined, period: undefined, page: undefined });
    });
  };

  const isStatusFiltered = selectedStatusValues.length > 0;

  const handleTimePeriodFilterChange = (values: string[]) => {
    startTransition(() => {
      if (values.length === 0) {
        updateSearchParams({ period: undefined, page: undefined });
      } else {
        updateSearchParams({ period: values[0], page: undefined });
      }
    });
  };

  const currentPeriod = searchParams.get('period');
  const selectedTimePeriodValues = currentPeriod ? [currentPeriod] : [];
  const isTimePeriodFiltered = selectedTimePeriodValues.length > 0;

  const columns = useMemo(() => {
    return [
      {
        header: 'Created',
        accessorKey: 'createdAt',
        cell: ({ row }) =>
          i18n.date(row.original.createdAt, { ...DateTime.DATETIME_SHORT, hourCycle: 'h12' }),
        filterFn: (row, id, value) => {
          const createdAt = row.getValue(id) as Date;
          if (!value || !Array.isArray(value) || value.length === 0) {
            return true;
          }

          const period = value[0] as TimePeriod;
          return isDateInPeriod(createdAt, period);
        },
      },
      {
        header: _(msg`Title`),
        accessorKey: 'title',
        cell: ({ row }) => <DataTableTitle row={row.original} teamUrl={team?.url} />,
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
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
        },
      },
      {
        header: _(msg`Actions`),
        cell: ({ row }) =>
          (!row.original.deletedAt || isDocumentCompleted(row.original.status)) && (
            <div className="flex items-center gap-x-4">
              <DocumentsTableActionButton row={row.original} />
              <DocumentsTableActionDropdown
                row={row.original}
                onMoveDocument={onMoveDocument ? () => onMoveDocument(row.original.id) : undefined}
              />
            </div>
          ),
      },
    ] satisfies DataTableColumnDef<DocumentsTableRow>[];
  }, [team, onMoveDocument]);

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

  const getEmptyStateStatus = (): ExtendedDocumentStatus => {
    if (selectedStatusValues.length > 0) {
      return selectedStatusValues[0] as ExtendedDocumentStatus;
    }
    return ExtendedDocumentStatus.ALL;
  };

  return (
    <div className="relative">
      <DataTable
        data={results.data}
        columns={columns}
        perPage={results.perPage}
        currentPage={results.currentPage}
        totalPages={results.totalPages}
        onPaginationChange={onPaginationChange}
        columnVisibility={{
          sender: team !== undefined,
        }}
        stats={data?.stats}
        onStatusFilterChange={handleStatusFilterChange}
        selectedStatusValues={selectedStatusValues}
        onTimePeriodFilterChange={handleTimePeriodFilterChange}
        selectedTimePeriodValues={selectedTimePeriodValues}
        onResetFilters={handleResetFilters}
        isStatusFiltered={isStatusFiltered}
        isTimePeriodFiltered={isTimePeriodFiltered}
        error={{
          enable: isLoadingError || false,
        }}
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
        emptyState={{
          enable: !isLoading && !isLoadingError,
          component: <DocumentsTableEmptyState status={getEmptyStateStatus()} />,
        }}
      >
        {(table) => <DataTablePagination additionalInformation="VisibleCount" table={table} />}
      </DataTable>

      {isPending && (
        <div className="bg-background/50 absolute inset-0 flex items-center justify-center">
          <Loader className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      )}
    </div>
  );
}

type DataTableTitleProps = {
  row: DocumentsTableRow;
  teamUrl?: string;
};

export const DataTableTitle = ({ row, teamUrl }: DataTableTitleProps) => {
  const { user } = useSession();

  const recipient = row.recipients.find((recipient) => recipient.email === user.email);

  const isOwner = row.user.id === user.id;
  const isRecipient = !!recipient;
  const isCurrentTeamDocument = teamUrl && row.team?.url === teamUrl;

  const documentsPath = formatDocumentsPath(isCurrentTeamDocument ? teamUrl : undefined);
  const formatPath = row.folderId
    ? `${documentsPath}/f/${row.folderId}/${row.id}`
    : `${documentsPath}/${row.id}`;

  return match({
    isOwner,
    isRecipient,
    isCurrentTeamDocument,
  })
    .with({ isOwner: true }, { isCurrentTeamDocument: true }, () => (
      <Link
        to={formatPath}
        title={row.title}
        className="block max-w-[10rem] truncate font-medium hover:underline md:max-w-[20rem]"
      >
        {row.title}
      </Link>
    ))
    .with({ isRecipient: true }, () => (
      <Link
        to={`/sign/${recipient?.token}`}
        title={row.title}
        className="block max-w-[10rem] truncate font-medium hover:underline md:max-w-[20rem]"
      >
        {row.title}
      </Link>
    ))
    .otherwise(() => (
      <span className="block max-w-[10rem] truncate font-medium hover:underline md:max-w-[20rem]">
        {row.title}
      </span>
    ));
};
