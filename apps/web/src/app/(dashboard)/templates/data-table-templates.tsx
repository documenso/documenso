'use client';

import { useTransition } from 'react';

import Link from 'next/link';

import { AlertTriangle, Loader } from 'lucide-react';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import type { Recipient, Template } from '@documenso/prisma/client';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';

import { LocaleDate } from '~/components/formatter/locale-date';
import { TemplateType } from '~/components/formatter/template-type';

import { DataTableActionDropdown } from './data-table-action-dropdown';
import { DataTableTitle } from './data-table-title';
import { UseTemplateDialog } from './use-template-dialog';

type TemplateWithRecipient = Template & {
  Recipient: Recipient[];
};

type TemplatesDataTableProps = {
  templates: Array<
    TemplateWithRecipient & {
      team: { id: number; url: string } | null;
    }
  >;
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

  const { remaining } = useLimits();

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
          <AlertTitle>Document Limit Exceeded!</AlertTitle>
          <AlertDescription className="mt-2">
            You have reached your document limit.{' '}
            <Link className="underline underline-offset-4" href="/settings/billing">
              Upgrade your account to continue!
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <DataTable
        columns={[
          {
            header: 'Created',
            accessorKey: 'createdAt',
            cell: ({ row }) => <LocaleDate date={row.original.createdAt} />,
          },
          {
            header: 'Title',
            cell: ({ row }) => <DataTableTitle row={row.original} />,
          },
          {
            header: 'Type',
            accessorKey: 'type',
            cell: ({ row }) => <TemplateType type={row.original.type} />,
          },
          {
            header: 'Actions',
            accessorKey: 'actions',
            cell: ({ row }) => {
              return (
                <div className="flex items-center gap-x-4">
                  <UseTemplateDialog
                    templateId={row.original.id}
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
        ]}
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
