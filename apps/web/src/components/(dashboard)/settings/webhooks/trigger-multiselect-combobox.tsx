import { useEffect, useState } from 'react';

import { WebhookTriggerEvents } from '@prisma/client/';
import { Check, ChevronsUpDown } from 'lucide-react';

import { toFriendlyWebhookEventName } from '@documenso/lib/universal/webhook/to-friendly-webhook-event-name';
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

import { truncateTitle } from '~/helpers/truncate-title';

type TriggerMultiSelectComboboxProps = {
  listValues: string[];
  onChange: (_values: string[]) => void;
};

export const TriggerMultiSelectCombobox = ({
  listValues,
  onChange,
}: TriggerMultiSelectComboboxProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);

  const triggerEvents = Object.values(WebhookTriggerEvents);

  useEffect(() => {
    setSelectedValues(listValues);
  }, [listValues]);

  const allEvents = [...new Set([...triggerEvents, ...selectedValues])];

  const handleSelect = (currentValue: string) => {
    let newSelectedValues;

    if (selectedValues.includes(currentValue)) {
      newSelectedValues = selectedValues.filter((value) => value !== currentValue);
    } else {
      newSelectedValues = [...selectedValues, currentValue];
    }

    setSelectedValues(newSelectedValues);
    onChange(newSelectedValues);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="w-[200px] justify-between"
        >
          {selectedValues.length > 0 ? selectedValues.length + ' selected...' : 'Select values...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-9999 w-full max-w-[280px] p-0">
        <Command>
          <CommandInput
            placeholder={truncateTitle(
              selectedValues.map((v) => toFriendlyWebhookEventName(v)).join(', '),
              15,
            )}
          />
          <CommandEmpty>No value found.</CommandEmpty>
          <CommandGroup>
            {allEvents.map((value: string, i: number) => (
              <CommandItem key={i} onSelect={() => handleSelect(value)}>
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    selectedValues.includes(value) ? 'opacity-100' : 'opacity-0',
                  )}
                />
                {toFriendlyWebhookEventName(value)}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
