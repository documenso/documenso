import { useMemo } from 'react';

import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { DocumentSource } from '@prisma/client';
import { InfoIcon } from 'lucide-react';
import { DateTime } from 'luxon';
import { useSearchParams } from 'react-router';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { trpc } from '@documenso/trpc/react';
import { ZFindDocumentsInternalRequestSchema } from '@documenso/trpc/server/document-router/find-documents-internal.types';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

import { DocumentStatus } from '~/components/general/document/document-status';
import { StackAvatarsWithTooltip } from '~/components/general/stack-avatars-with-tooltip';
import { DocumentsTableActionButton } from '~/components/tables/documents-table-action-button';
import { DocumentsTableActionDropdown } from '~/components/tables/documents-table-action-dropdown';
import { DataTableTitle } from '~/components/tables/documents-table-title';
import { TemplateDocumentsTableToolbar } from '~/components/tables/template-documents-table-toolbar';
import { useCurrentTeam } from '~/providers/team';

const DOCUMENT_SOURCE_LABELS: { [key in DocumentSource]: MessageDescriptor } = {
  DOCUMENT: msg`Document`,
  TEMPLATE: msg`Template`,
  TEMPLATE_DIRECT_LINK: msg`Direct link`,
};

const ZDocumentSearchParamsSchema = ZFindDocumentsInternalRequestSchema.pick({
  page: true,
  perPage: true,
  query: true,
  period: true,
  status: true,
  source: true,
});

type TemplatePageViewDocumentsTableProps = {
  templateId: number;
};

export const TemplatePageViewDocumentsTable = ({
  templateId,
}: TemplatePageViewDocumentsTableProps) => {
  const { _, i18n } = useLingui();

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const team = useCurrentTeam();

  const parsedSearchParams = ZDocumentSearchParamsSchema.parse(
    Object.fromEntries(searchParams ?? []),
  );

  const { data, isLoading, isLoadingError } = trpc.document.findDocumentsInternal.useQuery(
    {
      templateId,
      page: parsedSearchParams.page,
      perPage: parsedSearchParams.perPage,
      query: parsedSearchParams.query,
      source: parsedSearchParams.source,
      status: parsedSearchParams.status,
      period: parsedSearchParams.period,
    },
    {
      placeholderData: (previousData) => previousData,
    },
  );

  const onPaginationChange = (page: number, perPage: number) => {
    updateSearchParams({
      page,
      perPage,
    });
  };

  const results = data ?? {
    data: [],
    perPage: 10,
    currentPage: 1,
    totalPages: 1,
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
        cell: ({ row }) => <DocumentStatus status={row.getValue('status')} />,
        size: 140,
      },
      {
        header: () => (
          <div className="flex flex-row items-center">
            <Trans>Source</Trans>
            <Tooltip>
              <TooltipTrigger>
                <InfoIcon className="mx-2 h-4 w-4" />
              </TooltipTrigger>

              <TooltipContent className="max-w-md space-y-2 !p-0 text-foreground">
                <ul className="space-y-0.5 divide-y text-muted-foreground [&>li]:p-4">
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
        accessorKey: 'type',
        cell: ({ row }) => (
          <div className="flex flex-row items-center">
            {_(DOCUMENT_SOURCE_LABELS[row.original.source])}
          </div>
        ),
      },
      {
        id: 'actions',
        header: _(msg`Actions`),
        cell: ({ row }) => (
          <div className="flex items-center space-x-2">
            <DocumentsTableActionButton row={row.original} />

            <DocumentsTableActionDropdown row={row.original} />
          </div>
        ),
      },
    ] satisfies DataTableColumnDef<(typeof results)['data'][number]>[];
  }, []);

  return (
    <div className="space-y-4">
      <TemplateDocumentsTableToolbar />

      <DataTable
        columns={columns}
        data={results.data}
        perPage={results.perPage}
        currentPage={results.currentPage}
        totalPages={results.totalPages}
        onPaginationChange={onPaginationChange}
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
      >
        {(table) => <DataTablePagination additionalInformation="VisibleCount" table={table} />}
      </DataTable>
    </div>
  );
};
