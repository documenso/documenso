import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { DocumentSignatureType } from '@documenso/lib/constants/document';
import { trpc } from '@documenso/trpc/react';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Loader } from 'lucide-react';

import {
  DocumentPreferencesForm,
  type TDocumentPreferencesFormSchema,
} from '~/components/forms/document-preferences-form';
import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Document Preferences`);
}

export default function OrganisationSettingsDocumentPage() {
  const organisation = useCurrentOrganisation();

  const { t } = useLingui();
  const { toast } = useToast();

  const { data: organisationWithSettings, isLoading: isLoadingOrganisation } = trpc.organisation.get.useQuery({
    organisationReference: organisation.url,
  });

  const { mutateAsync: updateOrganisationSettings } = trpc.organisation.settings.update.useMutation();

  const onDocumentPreferencesFormSubmit = async (data: TDocumentPreferencesFormSchema) => {
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

      if (
        documentVisibility === null ||
        documentLanguage === null ||
        documentDateFormat === null ||
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
          defaultRecipients,
          typedSignatureEnabled: signatureTypes.includes(DocumentSignatureType.TYPE),
          uploadSignatureEnabled: signatureTypes.includes(DocumentSignatureType.UPLOAD),
          drawSignatureEnabled: signatureTypes.includes(DocumentSignatureType.DRAW),
          delegateDocumentOwnership,
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

  const settingsHeaderText = t`Document Preferences`;
  const settingsHeaderSubtitle = t`Here you can set document preferences for your organisation. Teams will inherit these settings by default.`;

  return (
    <div>
      <SettingsHeader title={settingsHeaderText} subtitle={settingsHeaderSubtitle} />

      <section>
        <DocumentPreferencesForm
          canInherit={false}
          settings={organisationWithSettings.organisationGlobalSettings}
          onFormSubmit={onDocumentPreferencesFormSubmit}
        />
      </section>
    </div>
  );
}
