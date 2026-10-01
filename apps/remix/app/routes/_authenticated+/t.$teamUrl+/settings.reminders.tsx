import { trpc } from '@documenso/trpc/react';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { useLingui } from '@lingui/react/macro';
import { Loader } from 'lucide-react';

import {
  ReminderPreferencesForm,
  type TReminderPreferencesFormSchema,
} from '~/components/forms/reminder-preferences-form';
import { SettingsHeader } from '~/components/general/settings-header';
import { useCurrentTeam } from '~/providers/team';

export default function TeamsSettingsRemindersPage() {
  const team = useCurrentTeam();

  const { t } = useLingui();
  const { toast } = useToast();

  const { data: teamWithSettings, isLoading: isLoadingTeam } = trpc.team.get.useQuery({
    teamReference: team.id,
  });

  const { mutateAsync: updateTeamSettings } = trpc.team.settings.update.useMutation();

  const onReminderPreferencesFormSubmit = async (data: TReminderPreferencesFormSchema) => {
    try {
      const { envelopeExpirationPeriod, reminderSettings } = data;

      await updateTeamSettings({
        teamId: team.id,
        data: {
          envelopeExpirationPeriod,
          reminderSettings,
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

  if (isLoadingTeam || !teamWithSettings) {
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
        subtitle={t`Here you can set expiration and signing reminder preferences for your team.`}
      />

      <section>
        <ReminderPreferencesForm
          canInherit={true}
          settings={teamWithSettings.teamSettings}
          onFormSubmit={onReminderPreferencesFormSubmit}
        />
      </section>
    </div>
  );
}
