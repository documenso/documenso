'use client';

import { useMemo, useTransition } from 'react';

import Link from 'next/link';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { AlertTriangle, Globe2Icon, InfoIcon, Link2Icon, Loader, LockIcon } from 'lucide-react';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import type { FindTemplateRow } from '@documenso/lib/server-only/template/find-templates';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

import { TemplateType } from '~/components/formatter/template-type';

import { DataTableActionDropdown } from './data-table-action-dropdown';
import { DataTableTitle } from './data-table-title';
import { TemplateDirectLinkBadge } from './template-direct-link-badge';
import { UseTemplateDialog } from './use-template-dialog';

type TemplatesDataTableProps = {
  templates: FindTemplateRow[];
  perPage: number;
  page: number;
  totalPages: number;
  documentRootPath: string;
  templateRootPath: string;
  teamId?: number;
};

export const TemplatesDataTable = ({
  templates,
  perPage,
  page,
  totalPages,
  documentRootPath,
  templateRootPath,
  teamId,
}: TemplatesDataTableProps) => {
  const [isPending, startTransition] = useTransition();

  const updateSearchParams = useUpdateSearchParams();

  const { _, i18n } = useLingui();
  const { remaining } = useLimits();

  const columns = useMemo(() => {
    return [
      {
        header: _(msg`Created`),
        accessorKey: 'createdAt',
        cell: ({ row }) => i18n.date(row.original.createdAt),
      },
      {
        header: _(msg`Title`),
        cell: ({ row }) => <DataTableTitle row={row.original} />,
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
                      {teamId ? <Trans>Team Only</Trans> : <Trans>Private</Trans>}
                    </h2>

                    <p>
                      {teamId ? (
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
              <UseTemplateDialog
                templateId={row.original.id}
                templateSigningOrder={row.original.templateMeta?.signingOrder}
                recipients={row.original.Recipient}
                documentRootPath={documentRootPath}
              />

              <DataTableActionDropdown
                row={row.original}
                teamId={teamId}
                templateRootPath={templateRootPath}
              />
            </div>
          );
        },
      },
    ] satisfies DataTableColumnDef<(typeof templates)[number]>[];
  }, [documentRootPath, teamId, templateRootPath]);

  const onPaginationChange = (page: number, perPage: number) => {
    startTransition(() => {
      updateSearchParams({
        page,
        perPage,
      });
    });
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
              <Link className="underline underline-offset-4" href="/settings/billing">
                Upgrade your account to continue!
              </Link>
            </Trans>
          </AlertDescription>
        </Alert>
      )}

      <DataTable
        columns={columns}
        data={templates}
        perPage={perPage}
        currentPage={page}
        totalPages={totalPages}
        onPaginationChange={onPaginationChange}
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
