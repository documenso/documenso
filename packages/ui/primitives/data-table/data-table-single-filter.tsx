import * as React from 'react';

import type { Column } from '@tanstack/react-table';

import { cn } from '../../lib/utils';
import { Badge } from '../badge';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
} from '../select';
import { Separator } from '../separator';

interface DataTableSingleFilterProps<TData, TValue> {
  column?: Column<TData, TValue>;
  title?: string;
  icon?: React.ComponentType<{ className?: string }>;
  onFilterChange?: (values: string[]) => void;
  selectedValues?: string[];
  options: {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
    color?: string;
    bgColor?: string;
  }[];
  groups?: {
    label: string;
    values: string[];
  }[];
}

export function DataTableSingleFilter<TData, TValue>({
  column,
  title,
  options,
  groups,
  icon: Icon,
  onFilterChange,
  selectedValues,
}: DataTableSingleFilterProps<TData, TValue>) {
  const filterValue = column?.getFilterValue() as string[] | undefined;
  const selectedValue = selectedValues?.[0] || (filterValue?.[0] ?? undefined);
  const selectedOption = options.find((option) => option.value === selectedValue);

  const handleValueChange = (value: string) => {
    if (value === selectedValue) {
      if (onFilterChange) {
        onFilterChange([]);
      } else {
        column?.setFilterValue(undefined);
      }
    } else {
      if (onFilterChange) {
        onFilterChange([value]);
      } else {
        column?.setFilterValue([value]);
      }
    }
  };

  const renderOptions = () => {
    if (groups) {
      return groups.map((group, groupIndex) => (
        <React.Fragment key={group.label}>
          <SelectGroup>
            <SelectLabel>{group.label}</SelectLabel>
            {options
              .filter((option) => group.values.includes(option.value))
              .map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-x-2">
                    {option.icon && (
                      <option.icon
                        className={cn(
                          'size-4',
                          option.color ? option.color : 'text-muted-foreground',
                        )}
                      />
                    )}
                    <span>{option.label}</span>
                  </div>
                </SelectItem>
              ))}
          </SelectGroup>
          {groupIndex < groups.length - 1 && <SelectSeparator />}
        </React.Fragment>
      ));
    }

    return (
      <SelectGroup>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-x-2">
              {option.icon && (
                <option.icon
                  className={cn('size-4', option.color ? option.color : 'text-muted-foreground')}
                />
              )}
              <span>{option.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectGroup>
    );
  };

  return (
    <Select value={selectedValue || ''} onValueChange={handleValueChange}>
      <SelectTrigger className="border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-auto gap-1.5 border border-dashed px-2.5 focus:ring-0">
        {Icon && <Icon className="size-4" />}
        {title}
        {selectedValue && selectedOption && (
          <>
            <Separator orientation="vertical" className="mx-1 h-8" />
            <Badge
              variant="neutral"
              className={cn(
                'rounded-sm border-none px-2 py-0.5 font-normal',
                selectedOption.bgColor ? selectedOption.bgColor : 'variant-secondary',
              )}
            >
              {selectedOption.label}
            </Badge>
          </>
        )}
      </SelectTrigger>
      <SelectContent>{renderOptions()}</SelectContent>
    </Select>
  );
}
