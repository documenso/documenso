import { Trans, useLingui } from '@lingui/react/macro';
import { Loader } from 'lucide-react';
import { Link } from 'react-router';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { putFile } from '@documenso/lib/universal/upload/put-file';
import { canExecuteOrganisationAction, isPersonalLayout } from '@documenso/lib/utils/organisations';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

import {
  BrandingPreferencesForm,
  type TBrandingPreferencesFormSchema,
} from '~/components/forms/branding-preferences-form';
import { SettingsHeader } from '~/components/general/settings-header';
import { useOptionalCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Branding Preferences');
}

export default function OrganisationSettingsBrandingPage() {
  const { organisations } = useSession();

  const organisation = useCurrentOrganisation();
  const team = useOptionalCurrentTeam();

  const { t } = useLingui();
  const { toast } = useToast();

  const isPersonalLayoutMode = isPersonalLayout(organisations);

  const { data: organisationWithSettings, isLoading: isLoadingOrganisation } =
    trpc.organisation.get.useQuery({
      organisationReference: organisation.url,
    });

  const { mutateAsync: updateOrganisationSettings } =
    trpc.organisation.settings.update.useMutation();

  const onBrandingPreferencesFormSubmit = async (data: TBrandingPreferencesFormSchema) => {
    try {
      const { brandingEnabled, brandingLogo, brandingUrl, brandingCompanyDetails } = data;

      let uploadedBrandingLogo: string | undefined = '';

      if (brandingLogo) {
        uploadedBrandingLogo = JSON.stringify(await putFile(brandingLogo));
      }

      await updateOrganisationSettings({
        organisationId: organisation.id,
        data: {
          brandingEnabled: brandingEnabled ?? undefined,
          brandingLogo: uploadedBrandingLogo,
          brandingUrl,
          brandingCompanyDetails,
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

  if (isLoadingOrganisation || !organisationWithSettings) {
    return (
      <div className="flex items-center justify-center rounded-lg py-32">
        <Loader className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  const settingsHeaderText = t`Branding Preferences`;

  const settingsHeaderSubtitle = isPersonalLayoutMode
    ? t`Here you can set your general branding preferences`
    : team
      ? t`Here you can set branding preferences for your team`
      : t`Here you can set branding preferences for your organisation. Teams will inherit these settings by default.`;

  return (
    <div className="max-w-2xl">
      <SettingsHeader title={settingsHeaderText} subtitle={settingsHeaderSubtitle} />

      {organisationWithSettings.organisationClaim.flags.allowCustomBranding ||
      !IS_BILLING_ENABLED() ? (
        <section>
          <BrandingPreferencesForm
            context="Organisation"
            settings={organisationWithSettings.organisationGlobalSettings}
            onFormSubmit={onBrandingPreferencesFormSubmit}
          />
        </section>
      ) : (
        <Alert
          className="mt-8 flex flex-col justify-between p-6 sm:flex-row sm:items-center"
          variant="neutral"
        >
          <div className="mb-4 sm:mb-0">
            <AlertTitle>
              <Trans>Branding Preferences</Trans>
            </AlertTitle>

            <AlertDescription className="mr-2">
              <Trans>Currently branding can only be configured for Teams and above plans.</Trans>
            </AlertDescription>
          </div>

          {canExecuteOrganisationAction('MANAGE_BILLING', organisation.currentOrganisationRole) && (
            <Button asChild variant="outline">
              <Link
                to={
                  isPersonalLayoutMode
                    ? '/settings/billing'
                    : `/o/${organisation.url}/settings/billing`
                }
              >
                <Trans>Update Billing</Trans>
              </Link>
            </Button>
          )}
        </Alert>
      )}
    </div>
  );
}
