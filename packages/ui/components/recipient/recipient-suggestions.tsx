import { useCallback, useRef, useState } from 'react';

import type { Recipient } from '@documenso/prisma/client';
import { cn } from '@documenso/ui/lib/utils';
import { Input } from '@documenso/ui/primitives/input';
import { Popover, PopoverAnchor, PopoverContent } from '@documenso/ui/primitives/popover';

import { Command, CommandGroup, CommandItem, CommandList } from '../../primitives/command';

export type AutocompleteInputProps = {
  type: 'email' | 'text';
  value: string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSelect?: (suggestion: Pick<Recipient, 'email' | 'name'>) => void;
  suggestions?: Pick<Recipient, 'email' | 'name'>[];
};

export const AutocompleteInput = ({
  type,
  value,
  placeholder,
  disabled,
  loading,
  onChange,
  onSelect,
  suggestions = [],
}: AutocompleteInputProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const minTypedQueryLength = 1;

  const inputRef = useRef<HTMLInputElement>(null);

  const showSuggestions = isOpen && value.length > minTypedQueryLength && !loading;
  const hasResults = suggestions.length > 0;
  const showNoResults = isOpen && !loading && !hasResults && value.length > minTypedQueryLength;

  const handleFocus = useCallback(() => {
    if (value.length > minTypedQueryLength) {
      setIsOpen(true);
    }
  }, [value.length, minTypedQueryLength]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event);

      const newValue = event.target.value;
      if (newValue.length > minTypedQueryLength) {
        setIsOpen(true);
        setSelectedIndex(-1);
      } else {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    },
    [onChange, minTypedQueryLength],
  );

  const handleSelectItem = useCallback(
    (suggestion: Pick<Recipient, 'email' | 'name'>) => {
      setIsOpen(false);
      setSelectedIndex(-1);
      onSelect?.(suggestion);
      inputRef.current?.focus();
    },
    [onSelect],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showSuggestions && !hasResults) return;

      if (event.key === 'Escape') {
        setIsOpen(false);
        setSelectedIndex(-1);
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
      }

      if (event.key === 'Enter') {
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          event.preventDefault();
          handleSelectItem(suggestions[selectedIndex]);
        }
      }
    },
    [showSuggestions, hasResults, suggestions, selectedIndex, handleSelectItem],
  );

  return (
    <Popover open={showSuggestions || showNoResults} onOpenChange={setIsOpen}>
      <PopoverAnchor asChild>
        <Input
          ref={inputRef}
          type={type}
          placeholder={placeholder}
          value={value}
          className="w-full"
          disabled={disabled}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
        />
      </PopoverAnchor>

      <PopoverContent
        className="w-full p-1"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
        }}
      >
        <Command>
          <CommandList role="listbox">
            <CommandGroup>
              {loading && (
                <div className="text-muted-foreground px-2 py-1.5 text-sm">
                  Loading suggestions...
                </div>
              )}
              {hasResults &&
                suggestions.map((suggestion, index) => (
                  <CommandItem
                    key={suggestion.email}
                    id={`suggestion-${index}`}
                    onSelect={() => handleSelectItem(suggestion)}
                    className={cn('cursor-pointer', index === selectedIndex && 'bg-accent')}
                    role="option"
                    aria-selected={index === selectedIndex}
                  >
                    {suggestion.name} ({suggestion.email})
                  </CommandItem>
                ))}
              {!loading && showNoResults && (
                <div className="text-muted-foreground px-2 py-1.5 text-sm">
                  No suggestions found
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
