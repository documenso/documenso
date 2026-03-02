import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { OrganisationGlobalSettings, TeamGlobalSettings } from '@prisma/client';

import { DOCUMENT_VISIBILITY } from '@documenso/lib/constants/document-visibility';

import { DetailsCard, DetailsValue } from '~/components/general/admin-details';

type AdminGlobalSettingsSectionProps = {
  settings: TeamGlobalSettings | OrganisationGlobalSettings | null;
  isTeam?: boolean;
};

export const AdminGlobalSettingsSection = ({
  settings,
  isTeam = false,
}: AdminGlobalSettingsSectionProps) => {
  const { _ } = useLingui();
  const notSetLabel = isTeam ? <Trans>Inherited</Trans> : <Trans>Not set</Trans>;

  if (!settings) {
    return null;
  }

  const textValue = (value: string | null | undefined) => {
    if (value === null || value === undefined) {
      return notSetLabel;
    }

    return value;
  };

  const brandingTextValue = (value: string | null | undefined) => {
    if (value === null || value === undefined || value.trim() === '') {
      return notSetLabel;
    }

    return value;
  };

  const booleanValue = (value: boolean | null | undefined) => {
    if (value === null || value === undefined) {
      return notSetLabel;
    }

    return value ? <Trans>Enabled</Trans> : <Trans>Disabled</Trans>;
  };

  const jsonValue = (value: unknown | null | undefined) => {
    if (value === null || value === undefined) {
      return notSetLabel;
    }

    return JSON.stringify(value);
  };

  return (
    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
      <DetailsCard label={<Trans>Document visibility</Trans>}>
        <DetailsValue>
          {settings.documentVisibility != null
            ? _(DOCUMENT_VISIBILITY[settings.documentVisibility].value)
            : notSetLabel}
        </DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Document language</Trans>}>
        <DetailsValue>{textValue(settings.documentLanguage)}</DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Document timezone</Trans>}>
        <DetailsValue>{textValue(settings.documentTimezone)}</DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Date format</Trans>}>
        <DetailsValue>{textValue(settings.documentDateFormat)}</DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Include sender details</Trans>}>
        <DetailsValue>{booleanValue(settings.includeSenderDetails)}</DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Include signing certificate</Trans>}>
        <DetailsValue>{booleanValue(settings.includeSigningCertificate)}</DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Include audit log</Trans>}>
        <DetailsValue>{booleanValue(settings.includeAuditLog)}</DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Delegate document ownership</Trans>}>
        <DetailsValue>{booleanValue(settings.delegateDocumentOwnership)}</DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Typed signature</Trans>}>
        <DetailsValue>{booleanValue(settings.typedSignatureEnabled)}</DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Upload signature</Trans>}>
        <DetailsValue>{booleanValue(settings.uploadSignatureEnabled)}</DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Draw signature</Trans>}>
        <DetailsValue>{booleanValue(settings.drawSignatureEnabled)}</DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Branding</Trans>}>
        <DetailsValue>{booleanValue(settings.brandingEnabled)}</DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Branding logo</Trans>}>
        <DetailsValue>{brandingTextValue(settings.brandingLogo)}</DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Branding URL</Trans>}>
        <DetailsValue>{brandingTextValue(settings.brandingUrl)}</DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Branding company details</Trans>}>
        <DetailsValue>{brandingTextValue(settings.brandingCompanyDetails)}</DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Email reply-to</Trans>}>
        <DetailsValue>{textValue(settings.emailReplyTo)}</DetailsValue>
      </DetailsCard>

      {isTeam && (
        <DetailsCard label={<Trans>Email document settings</Trans>}>
          <DetailsValue>{jsonValue(settings.emailDocumentSettings)}</DetailsValue>
        </DetailsCard>
      )}

      <DetailsCard label={<Trans>AI features</Trans>}>
        <DetailsValue>{booleanValue(settings.aiFeaturesEnabled)}</DetailsValue>
      </DetailsCard>
    </div>
  );
};
