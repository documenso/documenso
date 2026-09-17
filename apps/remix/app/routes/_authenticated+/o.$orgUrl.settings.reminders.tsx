import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { trpc } from '@documenso/trpc/react';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { useLingui } from '@lingui/react/macro';
import { Loader } from 'lucide-react';

import {
  ReminderPreferencesForm,
  type TReminderPreferencesFormSchema,
} from '~/components/forms/reminder-preferences-form';
import { SettingsHeader } from '~/components/general/settings-header';

export default function OrganisationSettingsRemindersPage() {
  const organisation = useCurrentOrganisation();

  const { t } = useLingui();
  const { toast } = useToast();

  const { data: organisationWithSettings, isLoading: isLoadingOrganisation } = trpc.organisation.get.useQuery({
    organisationReference: organisation.url,
  });

  const { mutateAsync: updateOrganisationSettings } = trpc.organisation.settings.update.useMutation();

  const onReminderPreferencesFormSubmit = async (data: TReminderPreferencesFormSchema) => {
    try {
      const { envelopeExpirationPeriod, reminderSettings } = data;

      await updateOrganisationSettings({
        organisationId: organisation.id,
        data: {
          envelopeExpirationPeriod: envelopeExpirationPeriod ?? undefined,
          reminderSettings: reminderSettings ?? undefined,
        },
      });

      toast({
        title: t`Reminder preferences updated`,
        description: t`Your reminder preferences have been updated`,
      });
    } catch (err) {
      toast({
        title: t`Something went wrong!`,
        description: t`We were unable to update your reminder preferences at this time, please try again later`,
        variant: 'destructive',
      });

      throw err;
    }
  };

  if (isLoadingOrganisation || !organisationWithSettings) {
    return (
      <div className="flex items-center justify-center rounded-lg py-32">
        <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <SettingsHeader
        title={t`Reminders`}
        subtitle={t`Here you can set expiration and signing reminder preferences for your organisation. Teams will inherit these settings by default.`}
      />

      <section>
        <ReminderPreferencesForm
          canInherit={false}
          settings={organisationWithSettings.organisationGlobalSettings}
          onFormSubmit={onReminderPreferencesFormSubmit}
        />
      </section>
    </div>
  );
}
