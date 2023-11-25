import config from '@documenso/tailwind-config';

import { Body, Container, Head, Html, Img, Preview, Section, Tailwind } from '../components';
import type { TemplateDocumentSelfSignedProps } from '../template-components/template-document-self-signed';
import { TemplateDocumentSelfSigned } from '../template-components/template-document-self-signed';
import { TemplateFooter } from '../template-components/template-footer';

export type DocumentSelfSignedTemplateProps = TemplateDocumentSelfSignedProps;

export const DocumentSelfSignedEmailTemplate = ({
  documentName = 'Open Source Pledge.pdf',
  assetBaseUrl = 'http://localhost:3002',
}: DocumentSelfSignedTemplateProps) => {
  const previewText = `Completed Document`;

  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: config.theme.extend.colors,
            },
          },
        }}
      >
        <Body className="mx-auto my-auto font-sans">
          <Section className="bg-white">
            <Container className="mx-auto mb-2 mt-8 max-w-xl rounded-lg border border-solid border-slate-200 p-2 backdrop-blur-sm">
              <Section className="p-2">
                <Img
                  src={getAssetUrl('/static/logo.png')}
                  alt="Documenso Logo"
                  className="mb-4 h-6"
                />

                <TemplateDocumentSelfSigned
                  documentName={documentName}
                  assetBaseUrl={assetBaseUrl}
                />
              </Section>
            </Container>

            <Container className="mx-auto max-w-xl">
              <TemplateFooter />
            </Container>
          </Section>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default DocumentSelfSignedEmailTemplate;
