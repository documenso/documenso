import * as React from 'react';

<<<<<<< HEAD
import { Check, ChevronsUpDown } from 'lucide-react';

import { Role } from '@documenso/prisma/client';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@documenso/ui/primitives/command';
import { Popover, PopoverContent, PopoverTrigger } from '@documenso/ui/primitives/popover';

type ComboboxProps = {
  listValues: string[];
  onChange: (_values: string[]) => void;
};

const Combobox = ({ listValues, onChange }: ComboboxProps) => {
  const [open, setOpen] = React.useState(false);
  const [selectedValues, setSelectedValues] = React.useState<string[]>([]);
  const dbRoles = Object.values(Role);

  React.useEffect(() => {
    setSelectedValues(listValues);
  }, [listValues]);

  const allRoles = [...new Set([...dbRoles, ...selectedValues])];

  const handleSelect = (currentValue: string) => {
    let newSelectedValues;
    if (selectedValues.includes(currentValue)) {
      newSelectedValues = selectedValues.filter((value) => value !== currentValue);
    } else {
      newSelectedValues = [...selectedValues, currentValue];
    }

    setSelectedValues(newSelectedValues);
    onChange(newSelectedValues);
    setOpen(false);
  };

=======
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '../lib/utils';
import { Button } from './button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

type ComboboxProps = {
  className?: string;
  options: string[];
  value: string | null;
  onChange: (_value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
};

const Combobox = ({
  className,
  options,
  value,
  onChange,
  disabled = false,
  placeholder,
}: ComboboxProps) => {
  const [open, setOpen] = React.useState(false);

  const onOptionSelected = (newValue: string) => {
    onChange(newValue === value ? null : newValue);
    setOpen(false);
  };

  const placeholderValue = placeholder ?? 'Select an option';

>>>>>>> main
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
<<<<<<< HEAD
          className="w-[200px] justify-between"
        >
          {selectedValues.length > 0 ? selectedValues.join(', ') : 'Select values...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder={selectedValues.join(', ')} />
          <CommandEmpty>No value found.</CommandEmpty>
          <CommandGroup>
            {allRoles.map((value: string, i: number) => (
              <CommandItem key={i} onSelect={() => handleSelect(value)}>
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    selectedValues.includes(value) ? 'opacity-100' : 'opacity-0',
                  )}
                />
                {value}
=======
          className={cn('my-2 w-full justify-between', className)}
          disabled={disabled}
        >
          {value ? value : placeholderValue}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="p-0" side="bottom" align="start">
        <Command>
          <CommandInput placeholder={value || placeholderValue} />

          <CommandEmpty>No value found.</CommandEmpty>

          <CommandGroup className="max-h-[250px] overflow-y-auto">
            {options.map((option, index) => (
              <CommandItem key={index} onSelect={() => onOptionSelected(option)}>
                <Check
                  className={cn('mr-2 h-4 w-4', option === value ? 'opacity-100' : 'opacity-0')}
                />

                {option}
>>>>>>> main
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export { Combobox };
