import { Trans } from '@lingui/react/macro';

import { Button, Section, Text } from '../components';
import { TemplateDocumentImage } from './template-document-image';

export type TemplateRecipientExpiredProps = {
  documentName: string;
  recipientName: string;
  recipientEmail: string;
  documentLink: string;
  assetBaseUrl: string;
};

export const TemplateRecipientExpired = ({
  documentName,
  recipientName,
  recipientEmail,
  documentLink,
  assetBaseUrl,
}: TemplateRecipientExpiredProps) => {
  const displayName = recipientName || recipientEmail;

  return (
    <>
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Section>
        <Text className="mx-auto mb-0 max-w-[80%] text-center font-semibold text-foreground text-lg">
          <Trans>
            Signing window expired for "{displayName}" on "{documentName}"
          </Trans>
        </Text>

        <Text className="my-1 text-center text-base text-muted-foreground">
          <Trans>
            The signing window for {displayName} on document "{documentName}" has expired. You can resend the document
            to extend their deadline or cancel the document.
          </Trans>
        </Text>

        <Section className="my-4 text-center">
          <Button
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-center font-medium text-primary-foreground text-sm no-underline"
            href={documentLink}
          >
            <Trans>View Document</Trans>
          </Button>
        </Section>
      </Section>
    </>
  );
};

export default TemplateRecipientExpired;
