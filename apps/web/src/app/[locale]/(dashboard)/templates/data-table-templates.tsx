'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { AlertTriangle, Loader, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
};

export const TemplatesDataTable = ({
  templates,
  perPage,
  page,
  totalPages,
}: TemplatesDataTableProps) => {
  const [isPending, startTransition] = useTransition();
  const updateSearchParams = useUpdateSearchParams();

  const { remaining } = useLimits();
  const { t } = useTranslation();

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
        title: `${t('document_created')}`,
        description: `${t('document_created_successfully')}`,
        duration: 5000,
      });

      router.push(`/documents/${id}`);
    } catch (err) {
      toast({
        title: `${t('error')}`,
        description: `${t('error_occurred_while_creating_document_from_template')}`,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="relative">
      {remaining.documents === 0 && (
        <Alert className="mb-4 mt-5">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('document_limit_exceeded')}</AlertTitle>
          <AlertDescription className="mt-2">
            {t('reached_document_limit')}{' '}
            <Link className="underline underline-offset-4" href="/settings/billing">
              {t('upgrade_account_to_continue')}
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <DataTable
        columns={[
          {
            header: `${t('created')}`,
            accessorKey: 'createdAt',
            cell: ({ row }) => <LocaleDate date={row.original.createdAt} />,
          },
          {
            header: `${t('title')}`,
            cell: ({ row }) => <DataTableTitle row={row.original} />,
          },
          {
            header: `${t('type')}`,
            accessorKey: 'type',
            cell: ({ row }) => <TemplateType type={row.original.type} />,
          },
          {
            header: `${t('actions')}`,
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
                    {t('use_template')}
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
