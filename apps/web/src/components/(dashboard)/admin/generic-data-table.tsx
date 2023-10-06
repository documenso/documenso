import { useTransition } from 'react';

import { ColumnDef } from '@tanstack/react-table';
import { Loader } from 'lucide-react';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';

type GenericDataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  perPage: number;
  currentPage: number;
  totalPages: number;
};

export function GenericDataTable<TData, TValue>({
  columns,
  data,
  perPage,
  currentPage,
  totalPages,
}: GenericDataTableProps<TData, TValue>) {
  const [isPending, startTransition] = useTransition();
  const updateSearchParams = useUpdateSearchParams();

  const onPaginationChange = (page: number, perPage: number) => {
    startTransition(() => {
      updateSearchParams({
        page: page.toString(),
        perPage: perPage.toString(),
      });
    });
  };

  return (
    <div className="relative">
      <DataTable
        columns={columns}
        data={data}
        perPage={perPage}
        currentPage={currentPage}
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
}
