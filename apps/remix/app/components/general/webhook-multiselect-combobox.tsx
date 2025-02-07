import { useEffect, useState } from 'react';

import { Plural, Trans } from '@lingui/react/macro';
import { WebhookTriggerEvents } from '@prisma/client';
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

import { truncateTitle } from '~/utils/truncate-title';

type WebhookMultiSelectComboboxProps = {
  listValues: string[];
  onChange: (_values: string[]) => void;
};

export const WebhookMultiSelectCombobox = ({
  listValues,
  onChange,
}: WebhookMultiSelectComboboxProps) => {
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
          <Plural value={selectedValues.length} zero="Select values" other="# selected..." />
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
          <CommandEmpty>
            <Trans>No value found.</Trans>
          </CommandEmpty>
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
