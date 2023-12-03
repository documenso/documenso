import config from '@documenso/tailwind-config';

import { Body, Container, Head, Html, Img, Preview, Section, Tailwind } from '../components';
import {
  TemplateDocumentDeleted,
  TemplateDocumentDeletedProps,
} from '../template-components/template-document-deleted';
import { TemplateFooter } from '../template-components/template-footer';

export type DocumentDeletedEmailTemplateProps = Partial<TemplateDocumentDeletedProps>;

export const DocumentDeletedEmailTemplate = ({
  inviterName = 'Lucas Smith',
  documentName = 'Open Source Pledge.pdf',
  assetBaseUrl = 'http://localhost:3002',
}: DocumentDeletedEmailTemplateProps) => {
  const previewText = `Document Deleted`;

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

                <TemplateDocumentDeleted
                  inviterName={inviterName}
                  documentName={documentName}
                  assetBaseUrl={assetBaseUrl}
                />
              </Section>
            </Container>

            <Container className="mx-auto max-w-xl">
              <TemplateFooter isDocument={false} />
            </Container>
          </Section>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default DocumentDeletedEmailTemplate;
