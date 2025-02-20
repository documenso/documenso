import { WebhookTriggerEvents } from '@prisma/client';

import { toFriendlyWebhookEventName } from '@documenso/lib/universal/webhook/to-friendly-webhook-event-name';
import { MultipleSelector } from '@documenso/ui/primitives/multiselect';

type WebhookMultiSelectComboboxProps = {
  listValues: string[];
  onChange: (_values: string[]) => void;
};

const triggerEvents = Object.values(WebhookTriggerEvents).map((value) => ({
  value,
  label: toFriendlyWebhookEventName(value),
}));

export const WebhookMultiSelectCombobox = ({
  listValues,
  onChange,
}: WebhookMultiSelectComboboxProps) => {
  const handleOnChange = (options: { value: string; label: string }[]) => {
    onChange(options.map((option) => option.value));
  };

  const mappedValues = listValues.map((value) => ({
    value,
    label: toFriendlyWebhookEventName(value),
  }));

  return (
    <MultipleSelector
      commandProps={{
        label: 'Select triggers',
      }}
      defaultOptions={triggerEvents}
      value={mappedValues}
      onChange={handleOnChange}
      placeholder="Select triggers"
      hideClearAllButton
      hidePlaceholderWhenSelected
      emptyIndicator={<p className="text-center text-sm">No triggers available</p>}
    />
  );
};
