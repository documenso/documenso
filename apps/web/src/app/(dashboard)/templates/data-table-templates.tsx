'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { AlertTriangle, Loader, Plus } from 'lucide-react';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import type { Template } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { LocaleDate } from '~/components/formatter/locale-date';
import { TemplateType } from '~/components/formatter/template-type';

import { DataTableActionDropdown } from './data-table-action-dropdown';
import { DataTableTitle } from './data-table-title';

type TemplatesDataTableProps = {
  templates: Template[];
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

  const router = useRouter();

  const { toast } = useToast();
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({});

  const { mutateAsync: createDocumentFromTemplate } =
    trpc.template.createDocumentFromTemplate.useMutation();

  const onPaginationChange = (page: number, perPage: number) => {
    startTransition(() => {
      updateSearchParams({
        page,
        perPage,
      });
    });
  };

  const onUseButtonClick = async (templateId: number) => {
    try {
      const { id } = await createDocumentFromTemplate({
        templateId,
      });

      toast({
        title: 'Document created',
        description: 'Your document has been created from the template successfully.',
        duration: 5000,
      });

      router.push(`${documentRootPath}/${id}`);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An error occurred while creating document from template.',
        variant: 'destructive',
      });
    }
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
              const isRowLoading = loadingStates[row.original.id];

              return (
                <div className="flex items-center gap-x-4">
                  <Button
                    disabled={isRowLoading || remaining.documents === 0}
                    loading={isRowLoading}
                    onClick={async () => {
                      setLoadingStates((prev) => ({ ...prev, [row.original.id]: true }));
                      await onUseButtonClick(row.original.id);
                      setLoadingStates((prev) => ({ ...prev, [row.original.id]: false }));
                    }}
                  >
                    {!isRowLoading && <Plus className="-ml-1 mr-2 h-4 w-4" />}
                    Use Template
                  </Button>

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
