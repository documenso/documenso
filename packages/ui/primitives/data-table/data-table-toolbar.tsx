import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import type { Table } from '@tanstack/react-table';
import { Calendar, CircleDashedIcon, Globe, ListFilter, X, XCircle } from 'lucide-react';

import { Button } from '../button';
import { Input } from '../input';
import { DataTableFacetedFilter } from './data-table-faceted-filter';
import { DataTableSingleFilter } from './data-table-single-filter';
import { sources, statuses, timePeriodGroups, timePeriods } from './data/data';

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
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
}

export function DataTableToolbar<TData>({
  table,
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
}: DataTableToolbarProps<TData>) {
  const { _ } = useLingui();
  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    isStatusFiltered ||
    isTimePeriodFiltered ||
    isSourceFiltered;
  const searchValue = (table.getColumn('title')?.getFilterValue() as string) ?? '';

  const handleClearFilter = () => {
    table.getColumn('title')?.setFilterValue('');
  };

  const handleReset = () => {
    table.resetColumnFilters();
    onResetFilters?.();
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center gap-2">
        <div className="relative">
          <Input
            className="peer h-8 w-[150px] pe-9 ps-9 lg:w-[250px]"
            placeholder={_(msg`Search documents...`)}
            value={searchValue}
            onChange={(event) => table.getColumn('title')?.setFilterValue(event.target.value)}
          />
          <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
            <ListFilter size={16} aria-hidden="true" />
          </div>
          {searchValue && (
            <button
              className="text-muted-foreground/80 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md outline-none transition-[color,box-shadow] focus:z-10 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={_(msg`Clear filter`)}
              onClick={handleClearFilter}
            >
              <XCircle className="size-3" aria-hidden="true" />
            </button>
          )}
        </div>

        {table.getColumn('status') && (
          <DataTableFacetedFilter
            column={table.getColumn('status')}
            title={_(msg`Status`)}
            options={statuses}
            icon={CircleDashedIcon}
            stats={stats}
            onFilterChange={onStatusFilterChange}
            selectedValues={selectedStatusValues}
          />
        )}

        {table.getColumn('createdAt') && (
          <DataTableSingleFilter
            column={table.getColumn('createdAt')}
            title={_(msg`Time Period`)}
            options={timePeriods}
            groups={timePeriodGroups}
            icon={Calendar}
            onFilterChange={onTimePeriodFilterChange}
            selectedValues={selectedTimePeriodValues}
          />
        )}

        {table.getColumn('source') && (
          <DataTableFacetedFilter
            column={table.getColumn('source')}
            title={_(msg`Source`)}
            options={sources}
            icon={Globe}
            onFilterChange={onSourceFilterChange}
            selectedValues={selectedSourceValues}
          />
        )}

        {isFiltered && (
          <Button variant="ghost" className="h-8 gap-2" size="sm" onClick={handleReset}>
            {_(msg`Reset`)}
            <X className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
