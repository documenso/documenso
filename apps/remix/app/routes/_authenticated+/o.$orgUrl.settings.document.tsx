import { useLingui } from '@lingui/react/macro';
import { Loader } from 'lucide-react';
import { useLoaderData } from 'react-router';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { IS_AI_FEATURES_CONFIGURED } from '@documenso/lib/constants/app';
import { DocumentSignatureType } from '@documenso/lib/constants/document';
import { isPersonalLayout } from '@documenso/lib/utils/organisations';
import { trpc } from '@documenso/trpc/react';
import { useToast } from '@documenso/ui/primitives/use-toast';

import {
  DocumentPreferencesForm,
  type TDocumentPreferencesFormSchema,
} from '~/components/forms/document-preferences-form';
import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Document Preferences');
}

export const loader = () => {
  return {
    isAiFeaturesConfigured: IS_AI_FEATURES_CONFIGURED(),
  };
};

export default function OrganisationSettingsDocumentPage() {
  const { isAiFeaturesConfigured } = useLoaderData<typeof loader>();

  const { organisations } = useSession();
  const organisation = useCurrentOrganisation();

  const { t } = useLingui();
  const { toast } = useToast();

  const isPersonalLayoutMode = isPersonalLayout(organisations);

  const { data: organisationWithSettings, isLoading: isLoadingOrganisation } =
    trpc.organisation.get.useQuery({
      organisationReference: organisation.url,
    });

  const { mutateAsync: updateOrganisationSettings } =
    trpc.organisation.settings.update.useMutation();

  const onDocumentPreferencesFormSubmit = async (data: TDocumentPreferencesFormSchema) => {
    try {
      const {
        documentVisibility,
        documentLanguage,
        documentTimezone,
        documentDateFormat,
        includeSenderDetails,
        includeSigningCertificate,
        includeAuditLog,
        signatureTypes,
        aiFeaturesEnabled,
      } = data;

      if (
        documentVisibility === null ||
        documentLanguage === null ||
        documentDateFormat === null ||
        includeSenderDetails === null ||
        includeSigningCertificate === null ||
        includeAuditLog === null ||
        aiFeaturesEnabled === null
      ) {
        throw new Error('Should not be possible.');
      }

      await updateOrganisationSettings({
        organisationId: organisation.id,
        data: {
          documentVisibility,
          documentLanguage,
          documentTimezone,
          documentDateFormat,
          includeSenderDetails,
          includeSigningCertificate,
          includeAuditLog,
          typedSignatureEnabled: signatureTypes.includes(DocumentSignatureType.TYPE),
          uploadSignatureEnabled: signatureTypes.includes(DocumentSignatureType.UPLOAD),
          drawSignatureEnabled: signatureTypes.includes(DocumentSignatureType.DRAW),
          aiFeaturesEnabled,
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

  if (isLoadingOrganisation || !organisationWithSettings) {
    return (
      <div className="flex items-center justify-center rounded-lg py-32">
        <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const settingsHeaderText = t`Document Preferences`;
  const settingsHeaderSubtitle = isPersonalLayoutMode
    ? t`Here you can set your general document preferences`
    : t`Here you can set document preferences for your organisation. Teams will inherit these settings by default.`;

  return (
    <div className="max-w-2xl">
      <SettingsHeader title={settingsHeaderText} subtitle={settingsHeaderSubtitle} />

      <section>
        <DocumentPreferencesForm
          canInherit={false}
          isAiFeaturesConfigured={isAiFeaturesConfigured}
          settings={organisationWithSettings.organisationGlobalSettings}
          onFormSubmit={onDocumentPreferencesFormSubmit}
        />
      </section>
    </div>
  );
}
