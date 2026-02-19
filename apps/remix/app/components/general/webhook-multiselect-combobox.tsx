import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { WebhookTriggerEvents } from '@prisma/client';

import { WEBHOOK_EVENT_TRANSLATIONS } from '@documenso/lib/universal/webhook/to-friendly-webhook-event-name';
import { MultiSelect, type Option } from '@documenso/ui/primitives/multiselect';

type WebhookMultiSelectComboboxProps = {
  listValues: string[];
  onChange: (_values: string[]) => void;
};

export const WebhookMultiSelectCombobox = ({
  listValues,
  onChange,
}: WebhookMultiSelectComboboxProps) => {
  const { _ } = useLingui();

  const triggerEvents = Object.values(WebhookTriggerEvents).map((event) => ({
    value: event,
    label: WEBHOOK_EVENT_TRANSLATIONS[event] ? _(WEBHOOK_EVENT_TRANSLATIONS[event]) : event,
  }));

  const value = listValues.map((event) => ({
    value: event,
    label: WEBHOOK_EVENT_TRANSLATIONS[event] ? _(WEBHOOK_EVENT_TRANSLATIONS[event]) : event,
  }));

  const onMutliSelectChange = (options: Option[]) => {
    onChange(options.map((option) => option.value));
  };

  return (
    <MultiSelect
      commandProps={{
        label: _(msg`Select triggers`),
      }}
      defaultOptions={triggerEvents}
      value={value}
      onChange={onMutliSelectChange}
      placeholder={_(msg`Select triggers`)}
      hideClearAllButton
      hidePlaceholderWhenSelected
      emptyIndicator={
        <p className="text-center text-sm">
          <Trans>No triggers available</Trans>
        </p>
      }
    />
  );
};
