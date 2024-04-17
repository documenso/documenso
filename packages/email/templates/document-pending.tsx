import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
} from '@react-email/components';

import config from '@documenso/tailwind-config';

import {
  TemplateDocumentPending,
  TemplateDocumentPendingProps,
} from '../template-components/template-document-pending';
import { TemplateFooter } from '../template-components/template-footer';

export type DocumentPendingEmailTemplateProps = Partial<TemplateDocumentPendingProps>;

export const DocumentPendingEmailTemplate = ({
  documentName = 'Open Source Pledge.pdf',
  assetBaseUrl = 'http://localhost:3002',
}: DocumentPendingEmailTemplateProps) => {
  const previewText = `Pending Document`;

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
            <Container className="mx-auto mb-2 mt-8 max-w-xl rounded-lg border border-solid border-slate-200 p-4 backdrop-blur-sm">
              <Section>
                <Img
                  src={getAssetUrl('/static/logo.png')}
                  alt="Documenso Logo"
                  className="mb-4 h-6"
                />

                <TemplateDocumentPending documentName={documentName} assetBaseUrl={assetBaseUrl} />
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

export default DocumentPendingEmailTemplate;
