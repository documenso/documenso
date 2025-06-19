import { useLingui } from '@lingui/react/macro';
import { Loader } from 'lucide-react';

import { DocumentSignatureType } from '@documenso/lib/constants/document';
import { putFile } from '@documenso/lib/universal/upload/put-file';
import { trpc } from '@documenso/trpc/react';
import { useToast } from '@documenso/ui/primitives/use-toast';

import {
  BrandingPreferencesForm,
  type TBrandingPreferencesFormSchema,
} from '~/components/forms/branding-preferences-form';
import {
  DocumentPreferencesForm,
  type TDocumentPreferencesFormSchema,
} from '~/components/forms/document-preferences-form';
import { SettingsHeader } from '~/components/general/settings-header';
import { useCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Preferences');
}

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
        includeSenderDetails,
        includeSigningCertificate,
        signatureTypes,
      } = data;

      await updateTeamSettings({
        teamId: team.id,
        data: {
          documentVisibility,
          documentLanguage,
          includeSenderDetails,
          includeSigningCertificate,
          ...(signatureTypes.length === 0
            ? {
                typedSignatureEnabled: null,
                uploadSignatureEnabled: null,
                drawSignatureEnabled: null,
              }
            : {
                typedSignatureEnabled: signatureTypes.includes(DocumentSignatureType.TYPE),
                uploadSignatureEnabled: signatureTypes.includes(DocumentSignatureType.UPLOAD),
                drawSignatureEnabled: signatureTypes.includes(DocumentSignatureType.DRAW),
              }),
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
    }
  };

  const onBrandingPreferencesFormSubmit = async (data: TBrandingPreferencesFormSchema) => {
    try {
      const { brandingEnabled, brandingLogo, brandingUrl, brandingCompanyDetails } = data;

      let uploadedBrandingLogo = teamWithSettings?.teamSettings?.brandingLogo;

      if (brandingLogo) {
        uploadedBrandingLogo = JSON.stringify(await putFile(brandingLogo));
      }

      if (brandingLogo === null) {
        uploadedBrandingLogo = '';
      }

      await updateTeamSettings({
        teamId: team.id,
        data: {
          brandingEnabled,
          brandingLogo: uploadedBrandingLogo || null,
          brandingUrl: brandingUrl || null,
          brandingCompanyDetails: brandingCompanyDetails || null,
        },
      });

      toast({
        title: t`Branding preferences updated`,
        description: t`Your branding preferences have been updated`,
      });
    } catch (err) {
      toast({
        title: t`Something went wrong`,
        description: t`We were unable to update your branding preferences at this time, please try again later`,
        variant: 'destructive',
      });
    }
  };

  if (isLoadingTeam || !teamWithSettings) {
    return (
      <div className="flex items-center justify-center rounded-lg py-32">
        <Loader className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <SettingsHeader
        title={t`Team Preferences`}
        subtitle={t`Here you can set preferences and defaults for your team.`}
      />

      <section>
        <DocumentPreferencesForm
          canInherit={true}
          settings={teamWithSettings.teamSettings}
          onFormSubmit={onDocumentPreferencesSubmit}
        />
      </section>

      <SettingsHeader
        title={t`Branding Preferences`}
        subtitle={t`Here you can set preferences and defaults for branding.`}
        className="mt-8"
      />

      <section>
        <BrandingPreferencesForm
          canInherit={true}
          context="Team"
          settings={teamWithSettings.teamSettings}
          onFormSubmit={onBrandingPreferencesFormSubmit}
        />
      </section>
    </div>
  );
}
