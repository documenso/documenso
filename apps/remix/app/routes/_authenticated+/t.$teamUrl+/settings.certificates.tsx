import { trpc } from '@documenso/trpc/react';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { useLingui } from '@lingui/react/macro';
import { Loader } from 'lucide-react';

import {
  CertificatePreferencesForm,
  type TCertificatePreferencesFormSchema,
} from '~/components/forms/certificate-preferences-form';
import { SettingsHeader } from '~/components/general/settings-header';
import { useCurrentTeam } from '~/providers/team';

export default function TeamsSettingsCertificatesPage() {
  const team = useCurrentTeam();

  const { t } = useLingui();
  const { toast } = useToast();

  const { data: teamWithSettings, isLoading: isLoadingTeam } = trpc.team.get.useQuery({
    teamReference: team.id,
  });

  const { mutateAsync: updateTeamSettings } = trpc.team.settings.update.useMutation();

  const onCertificatePreferencesFormSubmit = async (data: TCertificatePreferencesFormSchema) => {
    try {
      const { includeSigningCertificate, includeAuditLog } = data;

      await updateTeamSettings({
        teamId: team.id,
        data: {
          includeSigningCertificate,
          includeAuditLog,
        },
      });

      toast({
        title: t`Certificate preferences updated`,
        description: t`Your certificate preferences have been updated`,
      });
    } catch (err) {
      toast({
        title: t`Something went wrong!`,
        description: t`We were unable to update your certificate preferences at this time, please try again later`,
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
        title={t`Certificates`}
        subtitle={t`Here you can set certificate and audit log preferences for your team.`}
      />

      <section>
        <CertificatePreferencesForm
          canInherit={true}
          settings={teamWithSettings.teamSettings}
          onFormSubmit={onCertificatePreferencesFormSubmit}
        />
      </section>
    </div>
  );
}
