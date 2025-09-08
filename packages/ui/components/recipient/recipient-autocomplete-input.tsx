import React, { useRef, useState } from 'react';

import { Trans } from '@lingui/react/macro';

import { cn } from '@documenso/ui/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@documenso/ui/primitives/popover';

import { Command, CommandGroup, CommandItem, CommandTextInput } from '../../primitives/command';

export type RecipientAutoCompleteOption = {
  email: string;
  name: string | null;
};

type RecipientAutoCompleteInputProps = {
  type: 'email' | 'text';
  value: string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  options: RecipientAutoCompleteOption[];
  onSelect: (option: RecipientAutoCompleteOption) => void;
  onSearchQueryChange: (query: string) => void;
};

type CombinedProps = RecipientAutoCompleteInputProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, keyof RecipientAutoCompleteInputProps>;

const minTypedQueryLength = 1;

export const RecipientAutoCompleteInput = ({
  value,
  placeholder,
  disabled,
  loading,
  onSearchQueryChange,
  onSelect,
  options = [],
  ...props
}: CombinedProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);

  const onValueChange = (value: string) => {
    setIsOpen(!!value.length);
    onSearchQueryChange(value);
  };

  const handleSelectItem = (option: RecipientAutoCompleteOption) => {
    setIsOpen(false);
    setSelectedSuggestionIndex(-1);

    onSelect(option);

    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  return (
    <Command>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <CommandTextInput
            ref={inputRef}
            className="w-full"
            placeholder={placeholder}
            value={value}
            disabled={disabled}
            onValueChange={onValueChange}
            onBlur={props.onBlur}
          />
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-full p-0"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
          }}
        >
          {/* Not using <CommandEmpty /> here due to some weird behaviour */}
          {options.length === 0 && (
            <div className="px-2 py-1.5 text-sm">
              {loading ? (
                <Trans>Loading suggestions...</Trans>
              ) : (
                <Trans>No suggestions found</Trans>
              )}
            </div>
          )}

          {options.length > 0 && (
            <CommandGroup className="max-h-[250px] overflow-y-auto">
              {options.map((option, index) => (
                <CommandItem
                  key={`${index}-${option.email}`}
                  value={`${option.email}`}
                  className={cn('cursor-pointer', index === selectedSuggestionIndex && 'bg-accent')}
                  onSelect={() => handleSelectItem(option)}
                >
                  {option.name} ({option.email})
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </PopoverContent>
      </Popover>
    </Command>
  );
};
