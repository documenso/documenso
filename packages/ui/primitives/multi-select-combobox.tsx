'use client';

import * as React from 'react';

import { AnimatePresence } from 'framer-motion';
import { Check, ChevronsUpDown, Loader, XIcon } from 'lucide-react';

import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';

import { cn } from '../lib/utils';
import { Button } from './button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

type OptionValue = string | number | boolean | null;

type ComboBoxOption<T = OptionValue> = {
  label: string;
  value: T;
  disabled?: boolean;
};

type MultiSelectComboboxProps<T = OptionValue> = {
  emptySelectionPlaceholder?: React.ReactNode | string;
  enableClearAllButton?: boolean;
  loading?: boolean;
  inputPlaceholder?: string;
  onChange: (_values: T[]) => void;
  options: ComboBoxOption<T>[];
  selectedValues: T[];
};

/**
 * Multi select combo box component which supports:
 *
 * - Label/value pairs
 * - Loading state
 * - Clear all button
 */
export function MultiSelectCombobox<T = OptionValue>({
  emptySelectionPlaceholder = 'Select values...',
  enableClearAllButton,
  inputPlaceholder,
  loading,
  onChange,
  options,
  selectedValues,
}: MultiSelectComboboxProps<T>) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (selectedOption: T) => {
    let newSelectedOptions = [...selectedValues, selectedOption];

    if (selectedValues.includes(selectedOption)) {
      newSelectedOptions = selectedValues.filter((v) => v !== selectedOption);
    }

    onChange(newSelectedOptions);

    setOpen(false);
  };

  const selectedOptions = React.useMemo(() => {
    return selectedValues.map((value): ComboBoxOption<T> => {
      const foundOption = options.find((option) => option.value === value);

      if (foundOption) {
        return foundOption;
      }

      let label = '';

      if (typeof value === 'string' || typeof value === 'number') {
        label = value.toString();
      }

      return {
        label,
        value,
      };
    });
  }, [selectedValues, options]);

  const buttonLabel = React.useMemo(() => {
    if (loading) {
      return '';
    }

    if (selectedOptions.length === 0) {
      return emptySelectionPlaceholder;
    }

    return selectedOptions.map((option) => option.label).join(', ');
  }, [selectedOptions, emptySelectionPlaceholder, loading]);

  const showClearButton = enableClearAllButton && selectedValues.length > 0;

  return (
    <Popover open={open && !loading} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            disabled={loading}
            aria-expanded={open}
            className="w-[200px] px-3"
          >
            <AnimatePresence>
              {loading ? (
                <div className="flex items-center justify-center">
                  <Loader className="h-5 w-5 animate-spin text-gray-500 dark:text-gray-100" />
                </div>
              ) : (
                <AnimateGenericFadeInOut className="flex w-full justify-between">
                  <span className="truncate">{buttonLabel}</span>

                  <div
                    className={cn('ml-2 flex flex-row items-center', {
                      'ml-6': showClearButton,
                    })}
                  >
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </div>
                </AnimateGenericFadeInOut>
              )}
            </AnimatePresence>
          </Button>
        </PopoverTrigger>

        {/* This is placed outside the trigger since we can't have nested buttons. */}
        {showClearButton && !loading && (
          <div className="absolute bottom-0 right-8 top-0 flex items-center justify-center">
            <button
              className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-300 dark:bg-neutral-700"
              onClick={() => onChange([])}
            >
              <XIcon className="text-muted-foreground h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder={inputPlaceholder} />
          <CommandEmpty>No value found.</CommandEmpty>
          <CommandGroup>
            {options.map((option, i) => (
              <CommandItem key={i} onSelect={() => handleSelect(option.value)}>
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    selectedValues.includes(option.value) ? 'opacity-100' : 'opacity-0',
                  )}
                />
                {option.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
