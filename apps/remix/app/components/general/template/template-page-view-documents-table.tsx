import { useMemo } from 'react';

import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DocumentSource, DocumentStatus as DocumentStatusEnum } from '@prisma/client';
import { InfoIcon } from 'lucide-react';
import { DateTime } from 'luxon';
import { useSearchParams } from 'react-router';
import { z } from 'zod';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { ZUrlSearchParamsSchema } from '@documenso/lib/types/search-params';
import { trpc } from '@documenso/trpc/react';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { SelectItem } from '@documenso/ui/primitives/select';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

import { SearchParamSelector } from '~/components/forms/search-param-selector';
import { DocumentSearch } from '~/components/general/document/document-search';
import { DocumentStatus } from '~/components/general/document/document-status';
import { StackAvatarsWithTooltip } from '~/components/general/stack-avatars-with-tooltip';
import { DocumentsTableActionButton } from '~/components/tables/documents-table-action-button';
import { DocumentsTableActionDropdown } from '~/components/tables/documents-table-action-dropdown';
import { DataTableTitle } from '~/components/tables/documents-table-title';
import { useCurrentTeam } from '~/providers/team';

import { PeriodSelector } from '../period-selector';

const DOCUMENT_SOURCE_LABELS: { [key in DocumentSource]: MessageDescriptor } = {
  DOCUMENT: msg`Document`,
  TEMPLATE: msg`Template`,
  TEMPLATE_DIRECT_LINK: msg`Direct link`,
};

const ZDocumentSearchParamsSchema = ZUrlSearchParamsSchema.extend({
  source: z
    .nativeEnum(DocumentSource)
    .optional()
    .catch(() => undefined),
  status: z
    .nativeEnum(DocumentStatusEnum)
    .optional()
    .catch(() => undefined),
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

  const { data, isLoading, isLoadingError } = trpc.document.findDocuments.useQuery(
    {
      templateId,
      page: parsedSearchParams.page,
      perPage: parsedSearchParams.perPage,
      query: parsedSearchParams.query,
      source: parsedSearchParams.source,
      status: parsedSearchParams.status,
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
    <div>
      <div className="mb-4 flex flex-row space-x-4">
        <DocumentSearch />

        <SearchParamSelector
          paramKey="status"
          isValueValid={(value) =>
            [...DocumentStatusEnum.COMPLETED].includes(value as unknown as string)
          }
        >
          <SelectItem value="all">
            <Trans>Any Status</Trans>
          </SelectItem>
          <SelectItem value={DocumentStatusEnum.COMPLETED}>
            <Trans>Completed</Trans>
          </SelectItem>
          <SelectItem value={DocumentStatusEnum.PENDING}>
            <Trans>Pending</Trans>
          </SelectItem>
          <SelectItem value={DocumentStatusEnum.DRAFT}>
            <Trans>Draft</Trans>
          </SelectItem>
        </SearchParamSelector>

        <SearchParamSelector
          paramKey="source"
          isValueValid={(value) =>
            [...DocumentSource.TEMPLATE].includes(value as unknown as string)
          }
        >
          <SelectItem value="all">
            <Trans>Any Source</Trans>
          </SelectItem>
          <SelectItem value={DocumentSource.TEMPLATE}>
            <Trans>Template</Trans>
          </SelectItem>
          <SelectItem value={DocumentSource.TEMPLATE_DIRECT_LINK}>
            <Trans>Direct Link</Trans>
          </SelectItem>
        </SearchParamSelector>

        <PeriodSelector />
      </div>

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
