import { Popover, PopoverContent } from '@documenso/ui/primitives/popover';
import { Plural, Trans } from '@lingui/react/macro';
import { PopoverAnchor } from '@radix-ui/react-popover';
import { PlusIcon } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

import { Command, CommandGroup, CommandItem } from '../../primitives/command';
import { Input } from '../../primitives/input';

const CREATE_GROUP_OPTION_VALUE = '__create_group__';

export type FieldGroupAutoCompleteOption = {
  groupId: string;
  memberCount: number;
};

type FieldGroupAutoCompleteInputProps = {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  /**
   * The existing groups which the field is allowed to join.
   */
  options: FieldGroupAutoCompleteOption[];
  /**
   * Called when the user commits a value by selecting a suggestion, pressing enter, or
   * blurring the input. An empty string means the field should leave its group.
   */
  onGroupIdChange: (groupId: string) => void;
  /**
   * Called when the user chooses to create a new group. Must return the new group ID,
   * which is then committed like any other value.
   */
  onCreateGroup: () => string;
};

type CombinedProps = FieldGroupAutoCompleteInputProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, keyof FieldGroupAutoCompleteInputProps | 'onChange' | 'onBlur'>;

export const FieldGroupAutoCompleteInput = ({
  value,
  placeholder,
  disabled,
  options = [],
  onGroupIdChange,
  onCreateGroup,
  ...props
}: CombinedProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(value);

  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Set when the pointer goes down on a suggestion. The input blurs before the suggestion's
   * select event fires, so without this the blur would commit the partially typed query
   * instead of the chosen suggestion.
   */
  const isSelectingSuggestionRef = useRef(false);

  /**
   * The last committed value, so the blur which follows pressing enter does not commit
   * the same value a second time.
   */
  const lastCommittedGroupIdRef = useRef(value);

  // Reflect changes made outside the input, such as the field leaving its group.
  useEffect(() => {
    setSearchQuery(value);
    lastCommittedGroupIdRef.current = value;
  }, [value]);

  const trimmedQuery = searchQuery.trim();

  const filteredOptions = options.filter((option) => option.groupId.toLowerCase().includes(trimmedQuery.toLowerCase()));

  const commit = (groupId: string) => {
    const trimmedGroupId = groupId.trim();

    setIsOpen(false);
    setSearchQuery(trimmedGroupId);

    if (trimmedGroupId === lastCommittedGroupIdRef.current) {
      return;
    }

    lastCommittedGroupIdRef.current = trimmedGroupId;
    onGroupIdChange(trimmedGroupId);
  };

  const markSelectingSuggestion = () => {
    isSelectingSuggestionRef.current = true;
  };

  const handleSearchQueryChange = (nextValue: string) => {
    setSearchQuery(nextValue);
    setIsOpen(true);
  };

  const handleSelectOption = (option: FieldGroupAutoCompleteOption) => {
    commit(option.groupId);
  };

  const handleCreateGroup = () => {
    commit(onCreateGroup());
  };

  const handleBlur = () => {
    if (isSelectingSuggestionRef.current) {
      isSelectingSuggestionRef.current = false;
      return;
    }

    commit(trimmedQuery);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(trimmedQuery);
      inputRef.current?.blur();
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setSearchQuery(value);
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <Command shouldFilter={false}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverAnchor asChild>
          <Input
            ref={inputRef}
            className="w-full"
            placeholder={placeholder}
            value={searchQuery}
            disabled={disabled}
            autoComplete="off"
            onFocus={() => setIsOpen(true)}
            onChange={(e) => handleSearchQueryChange(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            {...props}
          />
        </PopoverAnchor>

        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
          }}
        >
          <CommandGroup className="max-h-[250px] overflow-y-auto" onMouseDown={markSelectingSuggestion}>
            {filteredOptions.map((option) => (
              <CommandItem
                key={option.groupId}
                value={option.groupId}
                className="cursor-pointer flex-col items-start gap-0.5"
                onSelect={() => handleSelectOption(option)}
              >
                <span className="font-medium">{option.groupId}</span>
                <span className="text-muted-foreground text-xs">
                  <Plural value={option.memberCount} one="# item" other="# items" />
                </span>
              </CommandItem>
            ))}

            <CommandItem value={CREATE_GROUP_OPTION_VALUE} className="cursor-pointer" onSelect={handleCreateGroup}>
              <PlusIcon className="mr-2 h-4 w-4" />
              <Trans>Create Group</Trans>
            </CommandItem>
          </CommandGroup>
        </PopoverContent>
      </Popover>
    </Command>
  );
};
