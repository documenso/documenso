import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { Body, Container, Head, Hr, Html, Preview, Section } from '../components';
import { TemplateBrandingLogo } from '../template-components/template-branding-logo';
import {
  TemplateDocumentDelete,
  type TemplateDocumentDeleteProps,
} from '../template-components/template-document-super-delete';
import { TemplateFooter } from '../template-components/template-footer';

export type DocumentDeleteEmailTemplateProps = Partial<TemplateDocumentDeleteProps>;

export const DocumentSuperDeleteEmailTemplate = ({
  documentName = 'Open Source Pledge.pdf',
  assetBaseUrl = 'http://localhost:3002',
  reason = 'Unknown',
}: DocumentDeleteEmailTemplateProps) => {
  const { _ } = useLingui();

  const previewText = msg`An admin has deleted your document "${documentName}".`;

  return (
    <Html>
      <Head />

      <Body className="mx-auto my-auto bg-background font-sans">
        <Preview>{_(previewText)}</Preview>

        <Section>
          <Container className="mx-auto mt-8 mb-2 max-w-xl rounded-lg border border-border border-solid p-4 backdrop-blur-sm">
            <Section>
              <TemplateBrandingLogo assetBaseUrl={assetBaseUrl} className="mb-4 h-6" />

              <TemplateDocumentDelete reason={reason} documentName={documentName} assetBaseUrl={assetBaseUrl} />
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

export default DocumentSuperDeleteEmailTemplate;
