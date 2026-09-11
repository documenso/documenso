import { cn } from '@documenso/ui/lib/utils';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@documenso/ui/primitives/command';
import { Popover, PopoverContent, PopoverTrigger } from '@documenso/ui/primitives/popover';
import { Separator } from '@documenso/ui/primitives/separator';
import { Trans } from '@lingui/react/macro';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react/dist/lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

export type FilterPillOption = {
  value: string;
  label: ReactNode;
  trailing?: string;
};

type FilterPillCommonProps = {
  icon: LucideIcon;
  label: ReactNode;
  options: FilterPillOption[];
  enableSearch?: boolean;
  searchPlaceholder?: string;
  loading?: boolean;
  testId?: string;
};

export type FilterPillSingleProps = FilterPillCommonProps & {
  multiple?: false;
  value: string | null;
  onChange: (value: string | null) => void;
  selectedLabel?: ReactNode;
};

export type FilterPillMultipleProps = FilterPillCommonProps & {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
};

export type FilterPillProps = FilterPillSingleProps | FilterPillMultipleProps;

/**
 * A faceted filter pill.
 *
 * Renders as a dashed "add a filter" pill at rest, and shows the current
 * selection inline once a value is picked. Selecting the active option
 * again (or the Clear row) removes it.
 *
 * Single select by default, closing on pick. When `multiple` is set the
 * popover stays open for toggling, and the trigger shows the first two
 * selections followed by a "+N more" chip.
 */
export const FilterPill = (props: FilterPillProps) => {
  const { icon: Icon, label, options, enableSearch, searchPlaceholder, loading, testId } = props;

  const [open, setOpen] = useState(false);

  const selectedValues = props.multiple ? props.value : props.value === null ? [] : [props.value];

  const selectedOptions = selectedValues
    .map((value) => options.find((option) => option.value === value))
    .filter((option): option is FilterPillOption => option !== undefined);

  const hasSelection = selectedOptions.length > 0;
  const extraCount = selectedOptions.length - 2;

  const onSelect = (nextValue: string) => {
    if (props.multiple) {
      const newValues = selectedValues.includes(nextValue)
        ? selectedValues.filter((value) => value !== nextValue)
        : [...selectedValues, nextValue];

      props.onChange(newValues);
      return;
    }

    props.onChange(nextValue === props.value ? null : nextValue);
    setOpen(false);
  };

  const onClear = () => {
    if (props.multiple) {
      props.onChange([]);
    } else {
      props.onChange(null);
    }

    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={loading}
          className={cn('border-dashed text-muted-foreground', {
            'border-solid text-foreground': hasSelection,
          })}
          data-testid={testId}
        >
          <Icon className="mr-2 h-4 w-4" />
          {label}

          {hasSelection && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />

              {props.multiple ? (
                <span className="flex items-center gap-x-1">
                  {selectedOptions.slice(0, 2).map((option) => (
                    <Badge key={option.value} variant="neutral" size="small">
                      {option.label}
                    </Badge>
                  ))}

                  {extraCount > 0 && (
                    <Badge variant="neutral" size="small">
                      <Trans>+{extraCount} more</Trans>
                    </Badge>
                  )}
                </span>
              ) : (
                <span className="font-medium">{props.selectedLabel ?? selectedOptions[0].label}</span>
              )}
            </>
          )}

          <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          {enableSearch && <CommandInput placeholder={searchPlaceholder} />}

          <CommandList>
            <CommandEmpty>
              <Trans>No results found.</Trans>
            </CommandEmpty>

            <CommandGroup>
              {options.map((option) => (
                <CommandItem key={option.value} onSelect={() => onSelect(option.value)}>
                  <CheckIcon
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      selectedValues.includes(option.value) ? 'opacity-100' : 'opacity-0',
                    )}
                  />

                  {option.label}

                  {option.trailing !== undefined && (
                    <span className="ml-auto pl-4 text-muted-foreground text-xs">{option.trailing}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>

            {hasSelection && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem className="justify-center text-center text-muted-foreground" onSelect={onClear}>
                    <Trans>Clear</Trans>
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
