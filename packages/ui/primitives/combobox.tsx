import * as React from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
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
  triggerPlaceholder?: string;
  placeholder?: string;
  disabled?: boolean;
  testId?: string;
};

const Combobox = ({
  className,
  options,
  value,
  onChange,
  disabled = false,
  triggerPlaceholder,
  placeholder,
  testId,
}: ComboboxProps) => {
  const { _ } = useLingui();

  const [open, setOpen] = React.useState(false);

  const onOptionSelected = (newValue: string) => {
    onChange(newValue === value ? null : newValue);
    setOpen(false);
  };

  const placeholderValue = placeholder ?? _(msg`Select an option`);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('my-2 w-full justify-between', className)}
          disabled={disabled}
          data-testid={testId}
        >
          {value ? value : triggerPlaceholder || placeholderValue}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="z-[1001] p-0" side="bottom" align="start">
        <Command>
          <CommandInput placeholder={value || placeholderValue} />

          <CommandEmpty>
            <Trans>No value found.</Trans>
          </CommandEmpty>

          <CommandGroup className="max-h-[250px] overflow-y-auto">
            {options.map((option, index) => (
              <CommandItem key={index} onSelect={() => onOptionSelected(option)}>
                <Check
                  className={cn('mr-2 h-4 w-4', option === value ? 'opacity-100' : 'opacity-0')}
                />

                {option}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export { Combobox };
