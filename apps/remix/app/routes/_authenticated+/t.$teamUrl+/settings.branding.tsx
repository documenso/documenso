import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { putFile } from '@documenso/lib/universal/upload/put-file';
import type { SanitizeBrandingCssWarning } from '@documenso/lib/utils/sanitize-branding-css';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { Loader } from 'lucide-react';
import { useState } from 'react';

import {
  BrandingPreferencesForm,
  type TBrandingPreferencesFormSchema,
} from '~/components/forms/branding-preferences-form';
import { SettingsHeader } from '~/components/general/settings-header';
import { useCurrentTeam } from '~/providers/team';

export default function TeamsSettingsPage() {
  const team = useCurrentTeam();
  const organisation = useCurrentOrganisation();

  const { t } = useLingui();
  const { toast } = useToast();

  const [cssWarnings, setCssWarnings] = useState<SanitizeBrandingCssWarning[]>([]);

  const {
    data: teamWithSettings,
    isLoading: isLoadingTeam,
    refetch: refetchTeam,
  } = trpc.team.get.useQuery({
    teamReference: team.id,
  });

  const { mutateAsync: updateTeamSettings } = trpc.team.settings.update.useMutation();

  const canCustomBranding =
    organisation.organisationClaim.flags.embedSigningWhiteLabel === true || !IS_BILLING_ENABLED();

  const onBrandingPreferencesFormSubmit = async (data: TBrandingPreferencesFormSchema) => {
    try {
      const { brandingEnabled, brandingLogo, brandingUrl, brandingCompanyDetails, brandingColors, brandingCss } = data;

      let uploadedBrandingLogo: string | undefined;

      if (brandingLogo) {
        uploadedBrandingLogo = JSON.stringify(await putFile(brandingLogo));
      }

      // Empty the branding logo if the user unsets it.
      if (brandingLogo === null) {
        uploadedBrandingLogo = '';
      }

      const result = await updateTeamSettings({
        teamId: team.id,
        data: {
          brandingEnabled,
          brandingLogo: uploadedBrandingLogo,
          brandingUrl: brandingUrl || null,
          brandingCompanyDetails: brandingCompanyDetails || null,
          brandingColors,
          brandingCss,
        },
      });

      // Refetch so the form re-syncs with the sanitised CSS that was
      // actually persisted (sanitiser may have dropped rules).
      await refetchTeam();

      const warnings = result?.cssWarnings ?? [];
      setCssWarnings(warnings);

      if (warnings.length > 0) {
        toast({
          title: t`Branding preferences updated with warnings`,
          description: plural(warnings.length, {
            one: '# CSS rule was dropped during sanitisation.',
            other: '# CSS rules were dropped during sanitisation.',
          }),
          duration: 8000,
        });
      } else {
        toast({
          title: t`Branding preferences updated`,
          description: t`Your branding preferences have been updated`,
        });
      }
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
        <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <SettingsHeader
        title={t`Branding Preferences`}
        subtitle={t`Here you can set preferences and defaults for branding.`}
      />

      <section>
        <BrandingPreferencesForm
          canInherit={true}
          hasAdvancedBranding={canCustomBranding}
          context="Team"
          settings={teamWithSettings.teamSettings}
          onFormSubmit={onBrandingPreferencesFormSubmit}
        />

        {cssWarnings.length > 0 && (
          <Alert variant="warning" className="mt-6">
            <AlertTitle>
              <Trans>CSS rules were dropped during sanitisation</Trans>
            </AlertTitle>

            <AlertDescription>
              <ul className="list-disc pl-5">
                {cssWarnings.map((warning, index) => (
                  <li key={index}>
                    {warning.detail}
                    {warning.line !== undefined && (
                      <span className="text-muted-foreground">
                        {' '}
                        <Trans>(line {warning.line})</Trans>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </section>
    </div>
  );
}
