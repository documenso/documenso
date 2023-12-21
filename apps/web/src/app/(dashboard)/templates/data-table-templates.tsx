'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Loader, Plus } from 'lucide-react';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import type { Template } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
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
};

export const TemplatesDataTable = ({
  templates,
  perPage,
  page,
  totalPages,
}: TemplatesDataTableProps) => {
  const [isPending, startTransition] = useTransition();
  const updateSearchParams = useUpdateSearchParams();

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

      router.push(`/documents/${id}`);
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
                    disabled={isRowLoading}
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
                  <DataTableActionDropdown row={row.original} />
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
