import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { trpc } from '@documenso/trpc/react';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { useLingui } from '@lingui/react/macro';
import { Loader } from 'lucide-react';

import {
  CertificatePreferencesForm,
  type TCertificatePreferencesFormSchema,
} from '~/components/forms/certificate-preferences-form';
import { SettingsHeader } from '~/components/general/settings-header';

export default function OrganisationSettingsCertificatesPage() {
  const organisation = useCurrentOrganisation();

  const { t } = useLingui();
  const { toast } = useToast();

  const { data: organisationWithSettings, isLoading: isLoadingOrganisation } = trpc.organisation.get.useQuery({
    organisationReference: organisation.url,
  });

  const { mutateAsync: updateOrganisationSettings } = trpc.organisation.settings.update.useMutation();

  const onCertificatePreferencesFormSubmit = async (data: TCertificatePreferencesFormSchema) => {
    try {
      const { includeSigningCertificate, includeAuditLog } = data;

      if (includeSigningCertificate === null || includeAuditLog === null) {
        throw new Error('Should not be possible.');
      }

      await updateOrganisationSettings({
        organisationId: organisation.id,
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
        title={t`Certificates`}
        subtitle={t`Here you can set certificate and audit log preferences for your organisation. Teams will inherit these settings by default.`}
      />

      <section>
        <CertificatePreferencesForm
          canInherit={false}
          settings={organisationWithSettings.organisationGlobalSettings}
          onFormSubmit={onCertificatePreferencesFormSubmit}
        />
      </section>
    </div>
  );
}
