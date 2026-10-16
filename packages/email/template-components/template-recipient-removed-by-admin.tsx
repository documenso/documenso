import { Trans } from '@lingui/react/macro';

import { Section, Text } from '../components';
import { TemplateDocumentImage } from './template-document-image';

export type TemplateRecipientRemovedByAdminAudience = 'recipient' | 'owner';

export type TemplateRecipientRemovedByAdminProps = {
  audience: TemplateRecipientRemovedByAdminAudience;
  documentName: string;
  recipientName: string;
  recipientEmail: string;
  assetBaseUrl: string;
};

export const TemplateRecipientRemovedByAdmin = ({
  audience,
  documentName,
  recipientName,
  recipientEmail,
  assetBaseUrl,
}: TemplateRecipientRemovedByAdminProps) => {
  const recipientLabel =
    recipientName && recipientName !== recipientEmail ? `${recipientName} (${recipientEmail})` : recipientEmail;

  return (
    <>
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Section>
        <Text className="mt-6 mb-0 text-left font-semibold text-foreground text-lg">
          {audience === 'recipient' ? (
            <Trans>You have been removed from a document</Trans>
          ) : (
            <Trans>A recipient has been removed from your document</Trans>
          )}
        </Text>

        <Text className="mx-auto mt-1 mb-6 text-left text-base text-muted-foreground">
          {audience === 'recipient' ? (
            <Trans>
              You have been removed from the document "{documentName}" by an administrator, typically at the request of
              the document sender.
            </Trans>
          ) : (
            <Trans>
              {recipientLabel} has been removed from the document "{documentName}" by an administrator, typically at the
              request of the document sender.
            </Trans>
          )}
        </Text>

        <Text className="mx-auto mt-1 mb-6 text-left text-base text-muted-foreground">
          {audience === 'recipient' ? (
            <Trans>
              There is no action required on your side. If you believe this was a mistake, please contact the document
              sender.
            </Trans>
          ) : (
            <Trans>
              There is no action required on your side. If you believe this was a mistake, please contact your
              administrator.
            </Trans>
          )}
        </Text>
      </Section>
    </>
  );
};

export default TemplateRecipientRemovedByAdmin;
