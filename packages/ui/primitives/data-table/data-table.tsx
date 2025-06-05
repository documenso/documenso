import * as React from 'react';
import { useMemo } from 'react';

import { Trans } from '@lingui/react/macro';
import type {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  SortingState,
  Updater,
  VisibilityState,
} from '@tanstack/react-table';
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

import type { DataTableChildren } from '../data-table';
import { Skeleton } from '../skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../table';
import { DataTableToolbar } from './data-table-toolbar';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  columnVisibility?: VisibilityState;
  perPage?: number;
  currentPage?: number;
  totalPages?: number;
  onPaginationChange?: (_page: number, _perPage: number) => void;
  children?: DataTableChildren<TData>;
  stats?: Record<string, number>;
  onStatusFilterChange?: (values: string[]) => void;
  selectedStatusValues?: string[];
  onTimePeriodFilterChange?: (values: string[]) => void;
  selectedTimePeriodValues?: string[];
  onSourceFilterChange?: (values: string[]) => void;
  selectedSourceValues?: string[];
  onResetFilters?: () => void;
  isStatusFiltered?: boolean;
  isTimePeriodFiltered?: boolean;
  isSourceFiltered?: boolean;
  skeleton?: {
    enable: boolean;
    rows: number;
    component?: React.ReactNode;
  };
  error?: {
    enable: boolean;
    component?: React.ReactNode;
  };
  emptyState?: {
    enable: boolean;
    component?: React.ReactNode;
  };
}

export function DataTable<TData, TValue>({
  columns,
  data,
  error,
  perPage,
  currentPage,
  totalPages,
  skeleton,
  onPaginationChange,
  children,
  stats,
  onStatusFilterChange,
  selectedStatusValues,
  onTimePeriodFilterChange,
  selectedTimePeriodValues,
  onSourceFilterChange,
  selectedSourceValues,
  onResetFilters,
  isStatusFiltered,
  isTimePeriodFiltered,
  isSourceFiltered,
  emptyState,
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const pagination = useMemo<PaginationState>(() => {
    if (currentPage !== undefined && perPage !== undefined) {
      return {
        pageIndex: currentPage - 1,
        pageSize: perPage,
      };
    }

    return {
      pageIndex: 0,
      pageSize: 0,
    };
  }, [currentPage, perPage]);

  const manualPagination = Boolean(currentPage !== undefined && totalPages !== undefined);

  const onTablePaginationChange = (updater: Updater<PaginationState>) => {
    if (typeof updater === 'function') {
      const newState = updater(pagination);

      onPaginationChange?.(newState.pageIndex + 1, newState.pageSize);
    } else {
      onPaginationChange?.(updater.pageIndex + 1, updater.pageSize);
    }
  };

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination: manualPagination ? pagination : undefined,
    },
    manualPagination,
    pageCount: totalPages,
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    onPaginationChange: onTablePaginationChange,
  });

  return (
    <>
      <div className="flex flex-col gap-4">
        <DataTableToolbar
          table={table}
          stats={stats}
          onStatusFilterChange={onStatusFilterChange}
          selectedStatusValues={selectedStatusValues}
          onTimePeriodFilterChange={onTimePeriodFilterChange}
          selectedTimePeriodValues={selectedTimePeriodValues}
          onSourceFilterChange={onSourceFilterChange}
          selectedSourceValues={selectedSourceValues}
          onResetFilters={onResetFilters}
          isStatusFiltered={isStatusFiltered}
          isTimePeriodFiltered={isTimePeriodFiltered}
          isSourceFiltered={isSourceFiltered}
        />
        {table.getRowModel().rows?.length || error?.enable || skeleton?.enable ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : error?.enable ? (
                  <TableRow>
                    {error.component ?? (
                      <TableCell colSpan={columns.length} className="h-32 text-center">
                        <Trans>Something went wrong.</Trans>
                      </TableCell>
                    )}
                  </TableRow>
                ) : skeleton?.enable ? (
                  Array.from({ length: skeleton.rows }).map((_, i) => (
                    <TableRow key={`skeleton-row-${i}`}>
                      {skeleton.component ?? <Skeleton />}
                    </TableRow>
                  ))
                ) : null}
              </TableBody>
            </Table>
          </div>
        ) : emptyState?.enable ? (
          (emptyState.component ?? (
            <div className="flex h-24 items-center justify-center text-center">No results.</div>
          ))
        ) : (
          <div className="flex h-24 items-center justify-center text-center">No results.</div>
        )}
      </div>

      {children && (table.getRowModel().rows?.length || error?.enable || skeleton?.enable) && (
        <div className="mt-8 w-full">{children(table)}</div>
      )}
    </>
  );
}
