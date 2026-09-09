import { DocumentSignatureType } from '@documenso/lib/constants/document';
import { trpc } from '@documenso/trpc/react';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { useLingui } from '@lingui/react/macro';
import { Loader } from 'lucide-react';

import {
  DocumentPreferencesForm,
  type TDocumentPreferencesFormSchema,
} from '~/components/forms/document-preferences-form';
import { SettingsHeader } from '~/components/general/settings-header';
import { useCurrentTeam } from '~/providers/team';

export default function TeamsSettingsPage() {
  const team = useCurrentTeam();

  const { t } = useLingui();
  const { toast } = useToast();

  const { data: teamWithSettings, isLoading: isLoadingTeam } = trpc.team.get.useQuery({
    teamReference: team.id,
  });

  const { mutateAsync: updateTeamSettings } = trpc.team.settings.update.useMutation();

  const onDocumentPreferencesSubmit = async (data: TDocumentPreferencesFormSchema) => {
    try {
      const {
        documentVisibility,
        documentLanguage,
        documentTimezone,
        documentDateFormat,
        signatureTypes,
        defaultRecipients,
        delegateDocumentOwnership,
        aiFeaturesEnabled,
      } = data;

      await updateTeamSettings({
        teamId: team.id,
        data: {
          documentVisibility,
          documentLanguage,
          documentTimezone,
          documentDateFormat,
          defaultRecipients,
          aiFeaturesEnabled,
          ...(signatureTypes.length === 0
            ? {
                typedSignatureEnabled: null,
                uploadSignatureEnabled: null,
                drawSignatureEnabled: null,
                qrSignatureEnabled: null,
              }
            : {
                typedSignatureEnabled: signatureTypes.includes(DocumentSignatureType.TYPE),
                uploadSignatureEnabled: signatureTypes.includes(DocumentSignatureType.UPLOAD),
                drawSignatureEnabled: signatureTypes.includes(DocumentSignatureType.DRAW),
                qrSignatureEnabled: signatureTypes.includes(DocumentSignatureType.QR),
              }),
          delegateDocumentOwnership,
        },
      });

      toast({
        title: t`Document preferences updated`,
        description: t`Your document preferences have been updated`,
      });
    } catch (err) {
      toast({
        title: t`Something went wrong!`,
        description: t`We were unable to update your document preferences at this time, please try again later`,
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
        title={t`Document Preferences`}
        subtitle={t`Here you can set preferences and defaults for your team.`}
      />

      <section>
        <DocumentPreferencesForm
          canInherit={true}
          settings={teamWithSettings.teamSettings}
          onFormSubmit={onDocumentPreferencesSubmit}
        />
      </section>
    </div>
  );
}
