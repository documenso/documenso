import { useMemo, useTransition } from 'react';

import { i18n } from '@lingui/core';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DocumentSource } from '@prisma/client';
import { InfoIcon, Loader } from 'lucide-react';
import { DateTime } from 'luxon';
import { useSearchParams } from 'react-router';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';
import { trpc } from '@documenso/trpc/react';
import type { TFindDocumentsInternalResponse } from '@documenso/trpc/server/document-router/schema';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { DataTable } from '@documenso/ui/primitives/data-table/data-table';
import {
  type TimePeriod,
  isDateInPeriod,
  timePeriods,
} from '@documenso/ui/primitives/data-table/utils/time-filters';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

import { DocumentStatus as DocumentStatusComponent } from '~/components/general/document/document-status';
import { StackAvatarsWithTooltip } from '~/components/general/stack-avatars-with-tooltip';
import { DocumentsTableActionButton } from '~/components/tables/documents-table-action-button';
import { DocumentsTableActionDropdown } from '~/components/tables/documents-table-action-dropdown';
import { DataTableTitle } from '~/components/tables/documents-table-title';
import { TemplateDocumentsTableEmptyState } from '~/components/tables/template-documents-table-empty-state';
import { useOptionalCurrentTeam } from '~/providers/team';

const DOCUMENT_SOURCE_LABELS: { [key in DocumentSource]: MessageDescriptor } = {
  DOCUMENT: msg`Document`,
  TEMPLATE: msg`Template`,
  TEMPLATE_DIRECT_LINK: msg`Direct link`,
};

type TemplatePageViewDocumentsTableProps = {
  templateId: number;
};

type DocumentsTableRow = TFindDocumentsInternalResponse['data'][number];

export const TemplatePageViewDocumentsTable = ({
  templateId,
}: TemplatePageViewDocumentsTableProps) => {
  const { _ } = useLingui();
  const [searchParams] = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const updateSearchParams = useUpdateSearchParams();

  const team = useOptionalCurrentTeam();

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
      updateSearchParams({
        status: undefined,
        source: undefined,
        period: undefined,
        page: undefined,
      });
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

  const handleSourceFilterChange = (values: string[]) => {
    startTransition(() => {
      if (values.length === 0) {
        updateSearchParams({ source: undefined, page: undefined });
      } else {
        updateSearchParams({ source: values.join(','), page: undefined });
      }
    });
  };

  const currentSource = searchParams.get('source');
  const selectedSourceValues = currentSource ? currentSource.split(',').filter(Boolean) : [];
  const isSourceFiltered = selectedSourceValues.length > 0;

  const sourceParam = searchParams.get('source');
  const statusParam = searchParams.get('status');
  const periodParam = searchParams.get('period');

  // Parse status parameter to handle multiple values
  const parsedStatus = statusParam
    ? statusParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((status) =>
          Object.values(ExtendedDocumentStatus).includes(status as ExtendedDocumentStatus),
        )
        .map((status) => status as ExtendedDocumentStatus)
    : undefined;

  const parsedPeriod =
    periodParam && timePeriods.includes(periodParam as TimePeriod)
      ? (periodParam as TimePeriod)
      : undefined;

  const { data, isLoading, isLoadingError } = trpc.document.findDocumentsInternal.useQuery(
    {
      templateId,
      page: Number(searchParams.get('page')) || 1,
      perPage: Number(searchParams.get('perPage')) || 10,
      query: searchParams.get('query') || undefined,
      source:
        sourceParam && Object.values(DocumentSource).includes(sourceParam as DocumentSource)
          ? (sourceParam as DocumentSource)
          : undefined,
      status: parsedStatus,
      period: parsedPeriod,
    },
    {
      placeholderData: (previousData) => previousData,
    },
  );

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
    stats: {
      [ExtendedDocumentStatus.DRAFT]: 0,
      [ExtendedDocumentStatus.PENDING]: 0,
      [ExtendedDocumentStatus.COMPLETED]: 0,
      [ExtendedDocumentStatus.REJECTED]: 0,
      [ExtendedDocumentStatus.INBOX]: 0,
      [ExtendedDocumentStatus.ALL]: 0,
    },
  };

  const getEmptyStateStatus = (): ExtendedDocumentStatus => {
    if (selectedStatusValues.length > 0) {
      return selectedStatusValues[0] as ExtendedDocumentStatus;
    }
    return ExtendedDocumentStatus.ALL;
  };

  const columns = useMemo(() => {
    return [
      {
        header: _(msg`Created`),
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
        cell: ({ row }) => <DocumentStatusComponent status={row.original.status} />,
        size: 140,
        filterFn: (row, id, value) => {
          if (!value || !Array.isArray(value) || value.length === 0) {
            return true;
          }
          return value.includes(row.getValue(id));
        },
      },
      {
        header: () => (
          <div className="flex flex-row items-center">
            <Trans>Source</Trans>
            <Tooltip>
              <TooltipTrigger>
                <InfoIcon className="mx-2 h-4 w-4" />
              </TooltipTrigger>

              <TooltipContent className="text-foreground max-w-md space-y-2 !p-0">
                <ul className="text-muted-foreground space-y-0.5 divide-y [&>li]:p-4">
                  <li>
                    <h2 className="mb-2 flex flex-row items-center font-semibold">
                      <Trans>Template</Trans>
                    </h2>

                    <p>
                      <Trans>
                        This document was created by you or a team member using the template above.
                      </Trans>
                    </p>
                  </li>

                  <li>
                    <h2 className="mb-2 flex flex-row items-center font-semibold">
                      <Trans>Direct Link</Trans>
                    </h2>

                    <p>
                      <Trans>This document was created using a direct link.</Trans>
                    </p>
                  </li>
                </ul>
              </TooltipContent>
            </Tooltip>
          </div>
        ),
        accessorKey: 'source',
        cell: ({ row }) => (
          <div className="flex flex-row items-center">
            {_(DOCUMENT_SOURCE_LABELS[row.original.source as DocumentSource])}
          </div>
        ),
        filterFn: (row, id, value) => {
          if (!value || !Array.isArray(value) || value.length === 0) {
            return true;
          }
          return value.includes(row.getValue(id));
        },
      },
      {
        header: _(msg`Actions`),
        cell: ({ row }) => (
          <div className="flex items-center gap-x-4">
            <DocumentsTableActionButton row={row.original} />
            <DocumentsTableActionDropdown row={row.original} />
          </div>
        ),
      },
    ] satisfies DataTableColumnDef<DocumentsTableRow>[];
  }, [_, team?.url]);

  return (
    <div className="relative">
      <DataTable
        data={results.data}
        columns={columns}
        perPage={results.perPage}
        currentPage={results.currentPage}
        totalPages={results.totalPages}
        onPaginationChange={onPaginationChange}
        stats={data?.stats}
        onStatusFilterChange={handleStatusFilterChange}
        selectedStatusValues={selectedStatusValues}
        onTimePeriodFilterChange={handleTimePeriodFilterChange}
        selectedTimePeriodValues={selectedTimePeriodValues}
        onSourceFilterChange={handleSourceFilterChange}
        selectedSourceValues={selectedSourceValues}
        onResetFilters={handleResetFilters}
        isStatusFiltered={isStatusFiltered}
        isTimePeriodFiltered={isTimePeriodFiltered}
        isSourceFiltered={isSourceFiltered}
        error={{
          enable: isLoadingError,
        }}
        skeleton={{
          enable: isLoading,
          rows: 3,
          component: (
            <>
              <TableCell>
                <Skeleton className="h-4 w-12 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24 rounded-full" />
              </TableCell>
              <TableCell className="py-4 pr-4">
                <Skeleton className="h-12 w-12 flex-shrink-0 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-12 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-12 rounded-full" />
              </TableCell>
              <TableCell>
                <div className="flex flex-row justify-end space-x-2">
                  <Skeleton className="h-10 w-20 rounded" />
                </div>
              </TableCell>
            </>
          ),
        }}
        emptyState={{
          enable: !isLoading && !isLoadingError,
          component: <TemplateDocumentsTableEmptyState status={getEmptyStateStatus()} />,
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
};
