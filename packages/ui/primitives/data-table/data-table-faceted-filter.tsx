import * as React from 'react';

import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { Column } from '@tanstack/react-table';
import { Check } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Badge } from '../badge';
import { Button } from '../button';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '../command';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';
import { Separator } from '../separator';

interface DataTableFacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>;
  title?: string;
  icon?: React.ComponentType<{ className?: string }>;
  stats?: Record<string, number>;
  onFilterChange?: (values: string[]) => void;
  selectedValues?: string[];
  options: {
    label: MessageDescriptor;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
    color?: string;
    bgColor?: string;
  }[];
}

export function DataTableFacetedFilter<TData, TValue>({
  column,
  title,
  icon: Icon,
  stats,
  onFilterChange,
  selectedValues,
  options,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const { _ } = useLingui();
  const facets = column?.getFacetedUniqueValues();
  const selectedValuesSet = new Set(selectedValues || (column?.getFilterValue() as string[]));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 border-dashed px-2.5">
          {Icon && <Icon className="size-4" />}
          {title}
          {selectedValuesSet.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-1 h-8" />
              <Badge variant="secondary" className="rounded-sm px-2 py-0.5 font-normal lg:hidden">
                {selectedValuesSet.size}
              </Badge>
              <div className="hidden gap-1 lg:flex">
                {selectedValuesSet.size > 2 ? (
                  <Badge variant="neutral" className="rounded-sm px-2 py-0.5 font-normal">
                    {selectedValuesSet.size} {_(msg`selected`)}
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedValuesSet.has(option.value))
                    .map((option) => (
                      <Badge
                        variant="neutral"
                        key={option.value}
                        className={cn(
                          'rounded-sm border-none px-2 py-0.5 font-normal',
                          option.bgColor ? option.bgColor : 'bg-secondary',
                        )}
                      >
                        {_(option.label)}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandList>
            <CommandEmpty>
              <Trans>No results found.</Trans>
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValuesSet.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    className="gap-x-2"
                    onSelect={() => {
                      if (isSelected) {
                        selectedValuesSet.delete(option.value);
                      } else {
                        selectedValuesSet.add(option.value);
                      }
                      const filterValues = Array.from(selectedValuesSet);

                      if (onFilterChange) {
                        onFilterChange(filterValues);
                      } else {
                        column?.setFilterValue(filterValues.length ? filterValues : undefined);
                      }
                    }}
                  >
                    <div
                      className={cn(
                        'flex size-4 items-center justify-center rounded-[4px] border',
                        isSelected
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-input [&_svg]:invisible',
                      )}
                    >
                      <Check className="text-primary-foreground size-3.5" />
                    </div>
                    {option.icon && (
                      <option.icon
                        className={cn(
                          'size-4',
                          option.color ? option.color : 'text-muted-foreground',
                        )}
                      />
                    )}
                    <span>{_(option.label)}</span>
                    {(stats?.[option.value] || facets?.get(option.value)) && (
                      <span className="text-muted-foreground ml-auto flex size-4 items-center justify-center font-mono text-xs">
                        {stats?.[option.value] || facets?.get(option.value)}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
