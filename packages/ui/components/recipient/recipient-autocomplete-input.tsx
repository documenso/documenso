import React, { useRef, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { PopoverAnchor } from '@radix-ui/react-popover';

import { Popover, PopoverContent } from '@documenso/ui/primitives/popover';

import { Command, CommandGroup, CommandItem } from '../../primitives/command';
import { Input } from '../../primitives/input';

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

export const RecipientAutoCompleteInput = ({
  value,
  placeholder,
  disabled,
  loading,
  onSearchQueryChange,
  onSelect,
  options = [],
  onChange: _onChange,
  ...props
}: CombinedProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const onValueChange = (value: string) => {
    setIsOpen(!!value.length);
    onSearchQueryChange(value);
  };

  const handleSelectItem = (option: RecipientAutoCompleteOption) => {
    setIsOpen(false);
    onSelect(option);
  };

  return (
    <Command>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverAnchor asChild>
          <Input
            ref={inputRef}
            className="w-full"
            placeholder={placeholder}
            value={value}
            disabled={disabled}
            onChange={(e) => onValueChange(e.target.value)}
            {...props}
          />
        </PopoverAnchor>

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
                  className="cursor-pointer"
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
