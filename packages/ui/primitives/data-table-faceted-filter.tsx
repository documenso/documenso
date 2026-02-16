import * as React from 'react';

import { Trans } from '@lingui/react/macro';
import { Check, PlusCircle } from 'lucide-react';

import { cn } from '../lib/utils';
import { Badge } from './badge';
import { Button } from './button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Separator } from './separator';

export type DataTableFacetedFilterOption = {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
};

export type DataTableFacetedFilterProps = {
  title: string;
  options: DataTableFacetedFilterOption[];
  selectedValues: string[];
  onSelectedValuesChange: (values: string[]) => void;
  singleSelect?: boolean;
  counts?: Record<string, number>;
  showSearch?: boolean;
};

export const DataTableFacetedFilter = ({
  title,
  options,
  selectedValues,
  onSelectedValuesChange,
  singleSelect,
  counts,
  showSearch = true,
}: DataTableFacetedFilterProps) => {
  const selectedValuesSet = new Set(selectedValues);

  const selectedOptions = options.filter((option) => selectedValuesSet.has(option.value));

  const onSelect = (value: string) => {
    if (singleSelect) {
      const nextValue = selectedValuesSet.has(value) ? [] : [value];

      onSelectedValuesChange(nextValue);

      return;
    }

    const nextValues = new Set(selectedValuesSet);

    if (nextValues.has(value)) {
      nextValues.delete(value);
    } else {
      nextValues.add(value);
    }

    onSelectedValuesChange(Array.from(nextValues));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 border-dashed">
          <PlusCircle className="mr-2 h-4 w-4" />
          {title}

          {selectedValues.length > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />

              <Badge
                variant="neutral"
                size="small"
                className="rounded-sm px-1 font-normal lg:hidden"
              >
                {selectedValues.length}
              </Badge>

              <div className="hidden gap-1 lg:flex">
                {selectedValues.length > 2 ? (
                  <Badge variant="neutral" size="small" className="rounded-sm px-1 font-normal">
                    {selectedValues.length} <Trans>selected</Trans>
                  </Badge>
                ) : (
                  selectedOptions.map((option) => (
                    <Badge
                      key={option.value}
                      variant="neutral"
                      size="small"
                      className="rounded-sm px-1 font-normal"
                    >
                      {option.label}
                    </Badge>
                  ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[220px] p-0" align="start">
        <Command shouldFilter={showSearch}>
          {showSearch && <CommandInput placeholder={title} />}

          <CommandList>
            <CommandEmpty>
              <Trans>No results found.</Trans>
            </CommandEmpty>

            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValuesSet.has(option.value);

                return (
                  <CommandItem key={option.value} onSelect={() => onSelect(option.value)}>
                    <div
                      className={cn(
                        'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 [&_svg]:invisible',
                      )}
                    >
                      <Check className="h-4 w-4" />
                    </div>

                    {option.icon && (
                      <option.icon
                        className={cn(
                          'mr-2 h-4 w-4',
                          option.iconClassName ?? 'text-muted-foreground',
                        )}
                      />
                    )}

                    <span>{option.label}</span>

                    {counts && counts[option.value] !== undefined && (
                      <span className="ml-auto flex h-4 w-4 items-center justify-center font-mono text-xs text-muted-foreground">
                        {counts[option.value]}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>

            {selectedValues.length > 0 && (
              <>
                <CommandSeparator />

                <CommandGroup>
                  <CommandItem
                    onSelect={() => onSelectedValuesChange([])}
                    className="justify-center text-center"
                  >
                    <Trans>Clear filters</Trans>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
