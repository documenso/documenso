import { Trans, useLingui } from '@lingui/react/macro';
import { Loader } from 'lucide-react';
import { Link } from 'react-router';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { DocumentSignatureType } from '@documenso/lib/constants/document';
import { canExecuteOrganisationAction } from '@documenso/lib/utils/organisations';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

import {
  DocumentPreferencesForm,
  type TDocumentPreferencesFormSchema,
} from '~/components/forms/document-preferences-form';
import { SettingsHeader } from '~/components/general/settings-header';
import { useCurrentTeam } from '~/providers/team';

export default function TeamsSettingsPage() {
  const team = useCurrentTeam();
  const organisation = useCurrentOrganisation();

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

  // Todo: Decide whether branding can be customized on the team level.
  // const onBrandingPreferencesFormSubmit = async (data: TBrandingPreferencesFormSchema) => {
  //   try {
  //     const { brandingEnabled, brandingLogo, brandingUrl, brandingCompanyDetails } = data;

  //     let uploadedBrandingLogo = settings?.brandingLogo;

  //     if (brandingLogo) {
  //       uploadedBrandingLogo = JSON.stringify(await putFile(brandingLogo));
  //     }

  //     if (brandingLogo === null) {
  //       uploadedBrandingLogo = '';
  //     }

  //     await updateTeamSettings({
  //       teamId: team.id,
  //       settings: {
  //         brandingEnabled,
  //         brandingLogo: uploadedBrandingLogo,
  //         brandingUrl,
  //         brandingCompanyDetails,
  //       },
  //     });

  //     toast({
  //       title: t`Branding preferences updated`,
  //       description: t`Your branding preferences have been updated`,
  //     });
  //   } catch (err) {
  //     toast({
  //       title: t`Something went wrong`,
  //       description: t`We were unable to update your branding preferences at this time, please try again later`,
  //       variant: 'destructive',
  //     });
  //   }
  // };

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

      <hr className="border-border/50 mt-8" />

      <Alert
        className="mt-8 flex flex-col justify-between p-6 sm:flex-row sm:items-center"
        variant="neutral"
      >
        <div className="mb-4 sm:mb-0">
          <AlertTitle>
            <Trans>Branding Preferences</Trans>
          </AlertTitle>

          <AlertDescription className="mr-2">
            <Trans>Currently branding can only be configured on the organisation level.</Trans>
          </AlertDescription>
        </div>

        {canExecuteOrganisationAction(
          'MANAGE_ORGANISATION',
          organisation.currentOrganisationRole,
        ) && (
          <Button asChild variant="outline">
            <Link to={`/org/${organisation.url}/settings/preferences`}>
              <Trans>Manage</Trans>
            </Link>
          </Button>
        )}
      </Alert>

      {/* <SettingsHeader
        title={t`Branding Preferences`}
        subtitle={t`Here you can set preferences and defaults for branding.`}
        className="mt-8"
      />

      <section>
        <BrandingPreferencesForm
          canInherit={false}
          settings={teamWithSettings.teamSettings}
          onFormSubmit={onBrandingPreferencesFormSubmit}
        />
      </section> */}
    </div>
  );
}
