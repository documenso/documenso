import {
  type TEnvelopeExpirationPeriod,
  ZEnvelopeExpirationPeriod,
} from '@documenso/lib/constants/envelope-expiration';
import { type TEnvelopeReminderSettings, ZEnvelopeReminderSettings } from '@documenso/lib/constants/envelope-reminder';
import { ExpirationPeriodPicker } from '@documenso/ui/components/document/expiration-period-picker';
import { ReminderSettingsPicker } from '@documenso/ui/components/document/reminder-settings-picker';
import { Form, FormControl, FormDescription, FormField, FormMessage } from '@documenso/ui/primitives/form/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import type { TeamGlobalSettings } from '@prisma/client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { FormStickySaveBar } from './form-sticky-save-bar';
import { InheritableField } from './inheritable-field';

const ZReminderPreferencesFormSchema = z.object({
  envelopeExpirationPeriod: ZEnvelopeExpirationPeriod.nullable(),
  reminderSettings: ZEnvelopeReminderSettings.nullable(),
});

export type TReminderPreferencesFormSchema = {
  envelopeExpirationPeriod: TEnvelopeExpirationPeriod | null;
  reminderSettings: TEnvelopeReminderSettings | null;
};

type SettingsSubset = Pick<TeamGlobalSettings, 'envelopeExpirationPeriod' | 'reminderSettings'>;

export type ReminderPreferencesFormProps = {
  settings: SettingsSubset;
  canInherit: boolean;
  onFormSubmit: (data: TReminderPreferencesFormSchema) => Promise<void>;
};

export const ReminderPreferencesForm = ({ settings, canInherit, onFormSubmit }: ReminderPreferencesFormProps) => {
  const { t } = useLingui();

  const form = useForm<TReminderPreferencesFormSchema>({
    defaultValues: {
      envelopeExpirationPeriod: settings.envelopeExpirationPeriod ?? null,
      reminderSettings: settings.reminderSettings ?? null,
    },
    resolver: zodResolver(ZReminderPreferencesFormSchema),
  });

  const handleFormSubmit = form.handleSubmit(async (data) => {
    try {
      await onFormSubmit(data);
    } catch {
      // The page handler surfaces its own error toast. Keep the form dirty so
      // the save bar stays visible and the user can retry.
      return;
    }

    form.reset(data);
  });

  return (
    <Form {...form}>
      <form onSubmit={handleFormSubmit}>
        <fieldset className="flex h-full flex-col gap-y-6" disabled={form.formState.isSubmitting}>
          <FormField
            control={form.control}
            name="envelopeExpirationPeriod"
            render={({ field }) => (
              <InheritableField
                className="flex-1"
                canInherit={canInherit}
                isInherited={field.value === null}
                label={<Trans>Default Envelope Expiration</Trans>}
                testId="envelope-expiration-period"
              >
                <FormControl>
                  <ExpirationPeriodPicker
                    value={field.value}
                    onChange={field.onChange}
                    inheritLabel={canInherit ? t`Inherit from organisation` : undefined}
                  />
                </FormControl>

                <FormDescription>
                  <Trans>
                    Controls how long recipients have to complete signing before the document expires. After expiration,
                    recipients can no longer sign the document.
                  </Trans>
                </FormDescription>

                <FormMessage />
              </InheritableField>
            )}
          />

          <FormField
            control={form.control}
            name="reminderSettings"
            render={({ field }) => (
              <InheritableField
                className="flex-1"
                canInherit={canInherit}
                isInherited={field.value === null}
                label={<Trans>Default Signing Reminders</Trans>}
                testId="reminder-settings"
              >
                <FormControl>
                  <ReminderSettingsPicker
                    value={field.value}
                    onChange={field.onChange}
                    inheritLabel={canInherit ? t`Inherit from organisation` : undefined}
                  />
                </FormControl>

                <FormDescription>
                  <Trans>
                    Controls when and how often reminder emails are sent to recipients who have not yet completed
                    signing.
                  </Trans>
                </FormDescription>

                <FormMessage />
              </InheritableField>
            )}
          />

          <FormStickySaveBar
            isDirty={form.formState.isDirty}
            isSubmitting={form.formState.isSubmitting}
            onReset={() => form.reset()}
          />
        </fieldset>
      </form>
    </Form>
  );
};
