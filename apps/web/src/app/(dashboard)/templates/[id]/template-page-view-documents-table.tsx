'use client';

import { useMemo } from 'react';

import { useSearchParams } from 'next/navigation';

import type { MessageDescriptor } from '@lingui/core';
import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { InfoIcon } from 'lucide-react';
import { DateTime } from 'luxon';
import { z } from 'zod';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { ZBaseTableSearchParamsSchema } from '@documenso/lib/types/search-params';
import type { Team } from '@documenso/prisma/client';
import { DocumentSource, DocumentStatus as DocumentStatusEnum } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { SelectItem } from '@documenso/ui/primitives/select';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

import { StackAvatarsWithTooltip } from '~/components/(dashboard)/avatar/stack-avatars-with-tooltip';
import { DocumentSearch } from '~/components/(dashboard)/document-search/document-search';
import { PeriodSelector } from '~/components/(dashboard)/period-selector/period-selector';
import { DocumentStatus } from '~/components/formatter/document-status';
import { SearchParamSelector } from '~/components/forms/search-param-selector';

import { DataTableActionButton } from '../../documents/data-table-action-button';
import { DataTableActionDropdown } from '../../documents/data-table-action-dropdown';
import { DataTableTitle } from '../../documents/data-table-title';

const DOCUMENT_SOURCE_LABELS: { [key in DocumentSource]: MessageDescriptor } = {
  DOCUMENT: msg`Document`,
  TEMPLATE: msg`Template`,
  TEMPLATE_DIRECT_LINK: msg`Direct link`,
};

const ZTemplateSearchParamsSchema = ZBaseTableSearchParamsSchema.extend({
  source: z
    .nativeEnum(DocumentSource)
    .optional()
    .catch(() => undefined),
  status: z
    .nativeEnum(DocumentStatusEnum)
    .optional()
    .catch(() => undefined),
  search: z.coerce
    .string()
    .optional()
    .catch(() => undefined),
});

type TemplatePageViewDocumentsTableProps = {
  templateId: number;
  team?: Team;
};

export const TemplatePageViewDocumentsTable = ({
  templateId,
  team,
}: TemplatePageViewDocumentsTableProps) => {
  const { _, i18n } = useLingui();

  const searchParams = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const parsedSearchParams = ZTemplateSearchParamsSchema.parse(
    Object.fromEntries(searchParams ?? []),
  );

  const { data, isLoading, isInitialLoading, isLoadingError } =
    trpc.document.findDocuments.useQuery(
      {
        templateId,
        teamId: team?.id,
        page: parsedSearchParams.page,
        perPage: parsedSearchParams.perPage,
        search: parsedSearchParams.search,
        source: parsedSearchParams.source,
        status: parsedSearchParams.status,
      },
      {
        keepPreviousData: true,
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
            recipients={row.original.Recipient}
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
            <DataTableActionButton team={team} row={row.original} />

            <DataTableActionDropdown team={team} row={row.original} />
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
          enable: isLoading && isInitialLoading,
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
