import * as React from 'react';

import { Check, ChevronDown } from 'lucide-react';

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
  onChange: (_value: string) => void;
  selectedValue: string | null;
  disabled?: boolean;
};

const Combobox = ({ listValues, onChange, selectedValue, disabled = false }: ComboboxProps) => {
  const [open, setOpen] = React.useState(false);
  const [selectedValueLocal, setSelectedValueLocal] = React.useState<string | null>(selectedValue);

  React.useEffect(() => {
    setSelectedValueLocal(selectedValue);
  }, [selectedValue]);

  const handleSelect = (currentValue: string) => {
    setSelectedValueLocal(currentValue === selectedValueLocal ? null : currentValue);
    onChange(currentValue === selectedValueLocal ? '' : currentValue);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="mb-2 mt-2 w-full justify-between"
          disabled={disabled}
        >
          {selectedValueLocal ? selectedValueLocal : 'Select Time Zone'}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-[250px] overflow-auto p-0" side="bottom" align="start">
        <Command>
          <CommandInput placeholder={selectedValueLocal || 'Select Time Zone'} />
          <CommandEmpty>No value found.</CommandEmpty>
          <CommandGroup>
            {listValues.map((value: string, i: number) => (
              <CommandItem key={i} onSelect={() => handleSelect(value)}>
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    selectedValueLocal === value ? 'opacity-100' : 'opacity-0',
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
