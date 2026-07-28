import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { Body, Container, Head, Html, Preview, Section } from '../components';
import { TemplateBrandingLogo } from '../template-components/template-branding-logo';
import type { TemplateDocumentSelfSignedProps } from '../template-components/template-document-self-signed';
import { TemplateDocumentSelfSigned } from '../template-components/template-document-self-signed';
import { TemplateFooter } from '../template-components/template-footer';

export type DocumentSelfSignedTemplateProps = TemplateDocumentSelfSignedProps;

export const DocumentSelfSignedEmailTemplate = ({
  documentName = 'Open Source Pledge.pdf',
  assetBaseUrl = 'http://localhost:3002',
}: DocumentSelfSignedTemplateProps) => {
  const { _ } = useLingui();

  const previewText = msg`Completed Document`;

  return (
    <Html>
      <Head />
      <Body className="mx-auto my-auto font-sans">
        <Preview>{_(previewText)}</Preview>

        <Section className="bg-background">
          <Container className="mx-auto mt-8 mb-2 max-w-xl rounded-lg border border-border border-solid p-2 backdrop-blur-sm">
            <Section className="p-2">
              <TemplateBrandingLogo assetBaseUrl={assetBaseUrl} className="mb-4 h-6" />

              <TemplateDocumentSelfSigned documentName={documentName} assetBaseUrl={assetBaseUrl} />
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

export default DocumentSelfSignedEmailTemplate;
