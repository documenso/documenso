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
  onSearchQueryChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSuggestionSelect?: (suggestion: Pick<Recipient, 'email' | 'name'>) => void;
  suggestions?: Pick<Recipient, 'email' | 'name'>[];
};

export const AutocompleteInput = ({
  type,
  value,
  placeholder,
  disabled,
  loading,
  onSearchQueryChange,
  onSuggestionSelect,
  suggestions = [],
}: AutocompleteInputProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const minTypedQueryLength = 1;

  const inputRef = useRef<HTMLInputElement>(null);

  const showSuggestions = isOpen && value.length > minTypedQueryLength && !loading;
  const hasResults = suggestions.length > 0;
  const showNoResults = isOpen && !loading && !hasResults;

  const handleFocus = () => {
    if (value.length > minTypedQueryLength) {
      setIsOpen(true);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onSearchQueryChange?.(event);

    const newValue = event.target.value;

    if (newValue.length > minTypedQueryLength) {
      setIsOpen(true);
      setSelectedIndex(-1);
    } else {
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  const handleSelectItem = (suggestion: Pick<Recipient, 'email' | 'name'>) => {
    setIsOpen(false);
    setSelectedIndex(-1);

    onSuggestionSelect?.(suggestion);

    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

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
    <Popover open={isOpen} onOpenChange={setIsOpen}>
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
              {hasResults && !loading
                ? suggestions.map((suggestion, index) => (
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
                  ))
                : null}
              {showNoResults ? (
                <div className="text-muted-foreground px-2 py-1.5 text-sm">
                  No suggestions found
                </div>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
