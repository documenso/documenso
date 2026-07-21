import { DOCUMENT_VISIBILITY } from '@documenso/lib/constants/document-visibility';
import { type TDocumentEmailSettings, ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { OrganisationGlobalSettings, TeamGlobalSettings } from '@prisma/client';
import type { ReactNode } from 'react';

import { DetailsCard, DetailsValue } from '~/components/general/admin-details';

const EMAIL_SETTINGS_LABELS: Record<keyof TDocumentEmailSettings, MessageDescriptor> = {
  recipientSigningRequest: msg`Recipient signing request`,
  recipientRemoved: msg`Recipient removed`,
  recipientSigned: msg`Recipient signed`,
  documentPending: msg`Document pending`,
  documentCompleted: msg`Document completed`,
  documentDeleted: msg`Document deleted`,
  ownerDocumentCompleted: msg`Owner document completed`,
  ownerRecipientExpired: msg`Owner recipient expired`,
  ownerDocumentCreated: msg`Owner document created`,
};

const emailSettingsKeys = Object.keys(EMAIL_SETTINGS_LABELS) as (keyof TDocumentEmailSettings)[];

type AdminGlobalSettingsSectionProps = {
  settings: TeamGlobalSettings | OrganisationGlobalSettings | null;
  isTeam?: boolean;
  /** When viewing a team, the parent organisation settings the team inherits from. */
  inheritedSettings?: OrganisationGlobalSettings | null;
};

export const AdminGlobalSettingsSection = ({
  settings,
  isTeam = false,
  inheritedSettings,
}: AdminGlobalSettingsSectionProps) => {
  const { _ } = useLingui();

  if (!settings) {
    return null;
  }

  const notSet = <Trans>Not set</Trans>;

  const inheritedValue = (value: ReactNode) => {
    if (!isTeam || value === null) {
      return notSet;
    }

    return (
      <span className="flex items-center gap-1.5">
        <span className="text-muted-foreground">
          <Trans>Inherited</Trans>:
        </span>
        <span>{value}</span>
      </span>
    );
  };

  const textValue = (value: string | null | undefined, inherited?: string | null) => {
    if (value && value.trim() !== '') {
      return value;
    }

    if (inherited && inherited.trim() !== '') {
      return inheritedValue(inherited);
    }

    return notSet;
  };

  const booleanLabel = (value: boolean) => (value ? <Trans>Enabled</Trans> : <Trans>Disabled</Trans>);

  const booleanValue = (value: boolean | null | undefined, inherited?: boolean | null) => {
    if (value !== null && value !== undefined) {
      return booleanLabel(value);
    }

    return inherited !== null && inherited !== undefined ? inheritedValue(booleanLabel(inherited)) : notSet;
  };

  const visibilityLabel = (value: string | null | undefined) => {
    return value && DOCUMENT_VISIBILITY[value] ? _(DOCUMENT_VISIBILITY[value].value) : null;
  };

  const visibilityValue = (value: string | null | undefined, inherited?: string | null) => {
    const label = visibilityLabel(value);

    if (label !== null) {
      return label;
    }

    return inheritedValue(visibilityLabel(inherited));
  };

  const parsedEmailSettings = ZDocumentEmailSettingsSchema.safeParse(settings.emailDocumentSettings);

  return (
    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
      <DetailsCard label={<Trans>Document visibility</Trans>}>
        <DetailsValue>
          {visibilityValue(settings.documentVisibility, inheritedSettings?.documentVisibility)}
        </DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Document language</Trans>}>
        <DetailsValue>{textValue(settings.documentLanguage, inheritedSettings?.documentLanguage)}</DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Document timezone</Trans>}>
        <DetailsValue>{textValue(settings.documentTimezone, inheritedSettings?.documentTimezone)}</DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Date format</Trans>}>
        <DetailsValue>{textValue(settings.documentDateFormat, inheritedSettings?.documentDateFormat)}</DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Include sender details</Trans>}>
        <DetailsValue>
          {booleanValue(settings.includeSenderDetails, inheritedSettings?.includeSenderDetails)}
        </DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Include signing certificate</Trans>}>
        <DetailsValue>
          {booleanValue(settings.includeSigningCertificate, inheritedSettings?.includeSigningCertificate)}
        </DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Include audit log</Trans>}>
        <DetailsValue>{booleanValue(settings.includeAuditLog, inheritedSettings?.includeAuditLog)}</DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Delegate document ownership</Trans>}>
        <DetailsValue>
          {booleanValue(settings.delegateDocumentOwnership, inheritedSettings?.delegateDocumentOwnership)}
        </DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Typed signature</Trans>}>
        <DetailsValue>
          {booleanValue(settings.typedSignatureEnabled, inheritedSettings?.typedSignatureEnabled)}
        </DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Upload signature</Trans>}>
        <DetailsValue>
          {booleanValue(settings.uploadSignatureEnabled, inheritedSettings?.uploadSignatureEnabled)}
        </DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Draw signature</Trans>}>
        <DetailsValue>
          {booleanValue(settings.drawSignatureEnabled, inheritedSettings?.drawSignatureEnabled)}
        </DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Branding</Trans>}>
        <DetailsValue>{booleanValue(settings.brandingEnabled, inheritedSettings?.brandingEnabled)}</DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Branding logo</Trans>}>
        <DetailsValue>{textValue(settings.brandingLogo, inheritedSettings?.brandingLogo)}</DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Branding URL</Trans>}>
        <DetailsValue>{textValue(settings.brandingUrl, inheritedSettings?.brandingUrl)}</DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Branding company details</Trans>}>
        <DetailsValue>
          {textValue(settings.brandingCompanyDetails, inheritedSettings?.brandingCompanyDetails)}
        </DetailsValue>
      </DetailsCard>

      <DetailsCard label={<Trans>Email reply-to</Trans>}>
        <DetailsValue>{textValue(settings.emailReplyTo, inheritedSettings?.emailReplyTo)}</DetailsValue>
      </DetailsCard>

      {isTeam && parsedEmailSettings.success && (
        <DetailsCard label={<Trans>Email document settings</Trans>}>
          <div className="mt-1 space-y-1 pr-3 pb-2 text-xs">
            {emailSettingsKeys.map((key) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{_(EMAIL_SETTINGS_LABELS[key])}</span>
                <span>{parsedEmailSettings.data[key] ? <Trans>On</Trans> : <Trans>Off</Trans>}</span>
              </div>
            ))}
          </div>
        </DetailsCard>
      )}

      <DetailsCard label={<Trans>AI features</Trans>}>
        <DetailsValue>{booleanValue(settings.aiFeaturesEnabled, inheritedSettings?.aiFeaturesEnabled)}</DetailsValue>
      </DetailsCard>
    </div>
  );
};
