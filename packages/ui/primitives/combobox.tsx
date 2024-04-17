import * as React from 'react';

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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
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
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export { Combobox };
