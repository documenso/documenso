'use client';

import React, { useMemo } from 'react';

import {
  ColumnDef,
  PaginationState,
  Table as TTable,
  Updater,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

export type DataTableChildren<TData> = (_table: TTable<TData>) => React.ReactNode;

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  perPage?: number;
  currentPage?: number;
  totalPages?: number;
  onPaginationChange?: (_page: number, _perPage: number) => void;
  children?: DataTableChildren<TData>;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  perPage,
  currentPage,
  totalPages,
  onPaginationChange,
  children,
}: DataTableProps<TData, TValue>) {
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
    getCoreRowModel: getCoreRowModel(),
    state: {
      pagination: manualPagination ? pagination : undefined,
    },
    manualPagination,
    pageCount: totalPages,
    onPaginationChange: onTablePaginationChange,
  });

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
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
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {children && <div className="mt-8 w-full">{children(table)}</div>}
    </>
  );
}
