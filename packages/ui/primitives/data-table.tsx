'use client';

import React, { useMemo } from 'react';

<<<<<<< HEAD
import {
=======
import type {
>>>>>>> main
  ColumnDef,
  PaginationState,
  Table as TTable,
  Updater,
<<<<<<< HEAD
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';

=======
  VisibilityState,
} from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';

import { Skeleton } from './skeleton';
>>>>>>> main
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

export type DataTableChildren<TData> = (_table: TTable<TData>) => React.ReactNode;

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
<<<<<<< HEAD
=======
  columnVisibility?: VisibilityState;
>>>>>>> main
  data: TData[];
  perPage?: number;
  currentPage?: number;
  totalPages?: number;
  onPaginationChange?: (_page: number, _perPage: number) => void;
<<<<<<< HEAD
  children?: DataTableChildren<TData>;
=======
  onClearFilters?: () => void;
  hasFilters?: boolean;
  children?: DataTableChildren<TData>;
  skeleton?: {
    enable: boolean;
    rows: number;
    component?: React.ReactNode;
  };
  error?: {
    enable: boolean;
    component?: React.ReactNode;
  };
>>>>>>> main
}

export function DataTable<TData, TValue>({
  columns,
<<<<<<< HEAD
  data,
  perPage,
  currentPage,
  totalPages,
=======
  columnVisibility,
  data,
  error,
  perPage,
  currentPage,
  totalPages,
  skeleton,
  hasFilters,
  onClearFilters,
>>>>>>> main
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
<<<<<<< HEAD
=======
      columnVisibility,
>>>>>>> main
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
<<<<<<< HEAD
                    <TableCell key={cell.id}>
=======
                    <TableCell
                      key={cell.id}
                      style={{
                        width: `${cell.column.getSize()}px`,
                      }}
                    >
>>>>>>> main
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
<<<<<<< HEAD
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
=======
            ) : error?.enable ? (
              <TableRow>
                {error.component ?? (
                  <TableCell colSpan={columns.length} className="h-32 text-center">
                    Something went wrong.
                  </TableCell>
                )}
              </TableRow>
            ) : skeleton?.enable ? (
              Array.from({ length: skeleton.rows }).map((_, i) => (
                <TableRow key={`skeleton-row-${i}`}>{skeleton.component ?? <Skeleton />}</TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <p>No results found</p>

                  {hasFilters && onClearFilters !== undefined && (
                    <button
                      onClick={() => onClearFilters()}
                      className="text-foreground mt-1 text-sm"
                    >
                      Clear filters
                    </button>
                  )}
>>>>>>> main
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
