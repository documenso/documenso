import config from '@documenso/tailwind-config';

import { Body, Container, Head, Hr, Html, Img, Preview, Section, Tailwind } from '../components';
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
  const previewText = `An admin has deleted your document "${documentName}".`;

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
        <Body className="mx-auto my-auto bg-white font-sans">
          <Section>
            <Container className="mx-auto mb-2 mt-8 max-w-xl rounded-lg border border-solid border-slate-200 p-4 backdrop-blur-sm">
              <Section>
                <Img
                  src={getAssetUrl('/static/logo.png')}
                  alt="Documenso Logo"
                  className="mb-4 h-6"
                />

                <TemplateDocumentDelete
                  reason={reason}
                  documentName={documentName}
                  assetBaseUrl={assetBaseUrl}
                />
              </Section>
            </Container>

            <Hr className="mx-auto mt-12 max-w-xl" />

            <Container className="mx-auto max-w-xl">
              <TemplateFooter />
            </Container>
          </Section>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default DocumentSuperDeleteEmailTemplate;
