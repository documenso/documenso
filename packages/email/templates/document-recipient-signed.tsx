import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { Body, Container, Head, Html, Preview, Section } from '../components';
import { TemplateBrandingLogo } from '../template-components/template-branding-logo';
import { TemplateDocumentRecipientSigned } from '../template-components/template-document-recipient-signed';
import { TemplateFooter } from '../template-components/template-footer';

export interface DocumentRecipientSignedEmailTemplateProps {
  documentName?: string;
  recipientName?: string;
  recipientEmail?: string;
  assetBaseUrl?: string;
}

export const DocumentRecipientSignedEmailTemplate = ({
  documentName = 'Open Source Pledge.pdf',
  recipientName = 'John Doe',
  recipientEmail = 'lucas@documenso.com',
  assetBaseUrl = 'http://localhost:3002',
}: DocumentRecipientSignedEmailTemplateProps) => {
  const { _ } = useLingui();

  const recipientReference = recipientName || recipientEmail;

  const previewText = msg`${recipientReference} has signed ${documentName}`;

  return (
    <Html>
      <Head />
      <Body className="mx-auto my-auto font-sans">
        <Preview>{_(previewText)}</Preview>

        <Section className="bg-background">
          <Container className="mx-auto mt-8 mb-2 max-w-xl rounded-lg border border-border border-solid p-2 backdrop-blur-sm">
            <Section className="p-2">
              <TemplateBrandingLogo assetBaseUrl={assetBaseUrl} className="mb-4 h-6" />

              <TemplateDocumentRecipientSigned
                documentName={documentName}
                recipientName={recipientName}
                recipientEmail={recipientEmail}
                assetBaseUrl={assetBaseUrl}
              />
            </Section>
          </Container>

          <Container className="mx-auto max-w-xl">
            <TemplateFooter />
          </Container>
        </Section>
      </Body>
    </Html>
  );
};

export default DocumentRecipientSignedEmailTemplate;
