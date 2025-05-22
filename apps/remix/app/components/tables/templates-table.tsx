import { useMemo, useTransition } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { AlertTriangle, Globe2Icon, InfoIcon, Link2Icon, Loader, LockIcon } from 'lucide-react';
import { Link } from 'react-router';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { formatTemplatesPath } from '@documenso/lib/utils/teams';
import type { TFindTemplatesResponse } from '@documenso/trpc/server/template-router/schema';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

import { TemplateType } from '~/components/general/template/template-type';
import { useCurrentTeam } from '~/providers/team';

import { TemplateUseDialog } from '../dialogs/template-use-dialog';
import { TemplateDirectLinkBadge } from '../general/template/template-direct-link-badge';
import { TemplatesTableActionDropdown } from './templates-table-action-dropdown';

type TemplatesTableProps = {
  data?: TFindTemplatesResponse;
  isLoading?: boolean;
  isLoadingError?: boolean;
  documentRootPath: string;
  templateRootPath: string;
};

type TemplatesTableRow = TFindTemplatesResponse['data'][number];

export const TemplatesTable = ({
  data,
  isLoading,
  isLoadingError,
  documentRootPath,
  templateRootPath,
}: TemplatesTableProps) => {
  const { _, i18n } = useLingui();
  const { remaining } = useLimits();

  const team = useCurrentTeam();
  const organisation = useCurrentOrganisation();

  const [isPending, startTransition] = useTransition();

  const updateSearchParams = useUpdateSearchParams();

  const formatTemplateLink = (row: TemplatesTableRow) => {
    const isCurrentTeamTemplate = team?.url && row.team?.url === team?.url;
    const path = formatTemplatesPath(isCurrentTeamTemplate ? team?.url : undefined);

    return `${path}/${row.id}`;
  };

  const columns = useMemo(() => {
    return [
      {
        header: _(msg`Created`),
        accessorKey: 'createdAt',
        cell: ({ row }) => i18n.date(row.original.createdAt),
      },
      {
        header: _(msg`Title`),
        cell: ({ row }) => (
          <Link
            to={formatTemplateLink(row.original)}
            className="block max-w-[10rem] cursor-pointer truncate font-medium hover:underline md:max-w-[20rem]"
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        header: () => (
          <div className="flex flex-row items-center">
            <Trans>Type</Trans>
            <Tooltip>
              <TooltipTrigger>
                <InfoIcon className="mx-2 h-4 w-4" />
              </TooltipTrigger>

              <TooltipContent className="text-foreground max-w-md space-y-2 !p-0">
                <ul className="text-muted-foreground space-y-0.5 divide-y [&>li]:p-4">
                  <li>
                    <h2 className="mb-2 flex flex-row items-center font-semibold">
                      <Globe2Icon className="mr-2 h-5 w-5 text-green-500 dark:text-green-300" />
                      <Trans>Public</Trans>
                    </h2>

                    <p>
                      <Trans>
                        Public templates are connected to your public profile. Any modifications to
                        public templates will also appear in your public profile.
                      </Trans>
                    </p>
                  </li>
                  <li>
                    <div className="mb-2 flex w-fit flex-row items-center rounded border border-neutral-300 bg-neutral-200 px-1.5 py-0.5 text-xs dark:border-neutral-500 dark:bg-neutral-600">
                      <Link2Icon className="mr-1 h-3 w-3" />
                      <Trans>direct link</Trans>
                    </div>

                    <p>
                      <Trans>
                        Direct link templates contain one dynamic recipient placeholder. Anyone with
                        access to this link can sign the document, and it will then appear on your
                        documents page.
                      </Trans>
                    </p>
                  </li>
                  <li>
                    <h2 className="mb-2 flex flex-row items-center font-semibold">
                      <LockIcon className="mr-2 h-5 w-5 text-blue-600 dark:text-blue-300" />
                      {team?.id ? <Trans>Team Only</Trans> : <Trans>Private</Trans>}
                    </h2>

                    <p>
                      {team?.id ? (
                        <Trans>
                          Team only templates are not linked anywhere and are visible only to your
                          team.
                        </Trans>
                      ) : (
                        <Trans>Private templates can only be modified and viewed by you.</Trans>
                      )}
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
            <TemplateType type={row.original.type} />

            {row.original.directLink?.token && (
              <TemplateDirectLinkBadge
                className="ml-2"
                token={row.original.directLink.token}
                enabled={row.original.directLink.enabled}
              />
            )}
          </div>
        ),
      },
      {
        header: _(msg`Actions`),
        accessorKey: 'actions',
        cell: ({ row }) => {
          return (
            <div className="flex items-center gap-x-4">
              <TemplateUseDialog
                templateId={row.original.id}
                templateSigningOrder={row.original.templateMeta?.signingOrder}
                documentDistributionMethod={row.original.templateMeta?.distributionMethod}
                recipients={row.original.recipients}
                documentRootPath={documentRootPath}
              />

              <TemplatesTableActionDropdown
                row={row.original}
                teamId={team?.id}
                templateRootPath={templateRootPath}
              />
            </div>
          );
        },
      },
    ] satisfies DataTableColumnDef<TemplatesTableRow>[];
  }, [documentRootPath, team?.id, templateRootPath]);

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
      {remaining.documents === 0 && (
        <Alert variant="warning" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            <Trans>Document Limit Exceeded!</Trans>
          </AlertTitle>
          <AlertDescription className="mt-2">
            <Trans>
              You have reached your document limit.{' '}
              <Link
                className="underline underline-offset-4"
                to={`/org/${organisation.url}/settings/billing`}
              >
                Upgrade your account to continue!
              </Link>
            </Trans>
          </AlertDescription>
        </Alert>
      )}

      <DataTable
        columns={columns}
        data={results.data}
        perPage={results.perPage}
        currentPage={results.currentPage}
        totalPages={results.totalPages}
        onPaginationChange={onPaginationChange}
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
      >
        {(table) => <DataTablePagination additionalInformation="VisibleCount" table={table} />}
      </DataTable>

      {isPending && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
          <Loader className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      )}
    </div>
  );
};
