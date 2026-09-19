import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { Body, Container, Head, Hr, Html, Preview, Section } from '../components';
import { TemplateBrandingLogo } from '../template-components/template-branding-logo';
import type { TemplateDocumentCancelProps } from '../template-components/template-document-cancel';
import { TemplateDocumentCancel } from '../template-components/template-document-cancel';
import { TemplateFooter } from '../template-components/template-footer';

export type DocumentCancelEmailTemplateProps = Partial<TemplateDocumentCancelProps>;

export const DocumentCancelTemplate = ({
  inviterName = 'Lucas Smith',
  inviterEmail = 'lucas@documenso.com',
  documentName = 'Open Source Pledge.pdf',
  assetBaseUrl = 'http://localhost:3002',
  cancellationReason,
}: DocumentCancelEmailTemplateProps) => {
  const { _ } = useLingui();

  const previewText = msg`${inviterName} has cancelled the document ${documentName}, you don't need to sign it anymore.`;

  return (
    <Html>
      <Head />

      <Body className="mx-auto my-auto bg-background font-sans">
        <Preview>{_(previewText)}</Preview>

        <Section>
          <Container className="mx-auto mt-8 mb-2 max-w-xl rounded-lg border border-border border-solid p-4 backdrop-blur-sm">
            <Section>
              <TemplateBrandingLogo assetBaseUrl={assetBaseUrl} className="mb-4 h-6" />

              <TemplateDocumentCancel
                inviterName={inviterName}
                inviterEmail={inviterEmail}
                documentName={documentName}
                assetBaseUrl={assetBaseUrl}
                cancellationReason={cancellationReason}
              />
            </Section>
          </Container>

          <Hr className="mx-auto mt-12 max-w-xl" />

          <Container className="mx-auto max-w-xl">
            <TemplateFooter />
          </Container>
        </Section>
      </Body>
    </Html>
  );
};

export default DocumentCancelTemplate;
