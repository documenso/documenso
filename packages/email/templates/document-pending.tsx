import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';

import * as config from '@documenso/tailwind-config';

interface DocumentPendingEmailTemplateProps {
  documentName?: string;
  assetBaseUrl?: string;
}

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
            <Container className="mx-auto mb-2 mt-8 max-w-xl rounded-lg border border-solid border-slate-200 p-2 backdrop-blur-sm">
              <Section className="p-2">
                <Img src={getAssetUrl('/static/logo.png')} alt="Documenso Logo" className="h-6" />

                <Section className="mt-4 flex-row items-center justify-center">
                  <div className="flex items-center justify-center p-4">
                    <Img
                      className="h-42"
                      src={getAssetUrl('/static/document.png')}
                      alt="Documenso"
                    />
                  </div>

                  <Text className="mb-4 flex items-center justify-center text-center text-base font-semibold text-blue-500">
                    <Img
                      src={getAssetUrl('/static/clock.png')}
                      className="-mb-0.5 mr-2 inline h-7 w-7"
                    />
                    Waiting for others
                  </Text>

                  <Text className="text-primary mb-0 text-center text-lg font-semibold">
                    “{documentName}” has been signed
                  </Text>

                  <Text className="mx-auto mb-6 mt-1 max-w-[80%] text-center text-base text-slate-400">
                    We're still waiting for other signers to sign this document.
                    <br />
                    We'll notify you as soon as it's ready.
                  </Text>
                </Section>
              </Section>
            </Container>

            <Container className="mx-auto max-w-xl">
              <Section>
                <Text className="my-4 text-base text-slate-400">
                  This document was sent using{' '}
                  <Link className="text-[#7AC455]" href="https://documenso.com">
                    Documenso.
                  </Link>
                </Text>

                <Text className="my-8 text-sm text-slate-400">
                  Documenso
                  <br />
                  2261 Market Street, #5211, San Francisco, CA 94114, USA
                </Text>
              </Section>
            </Container>
          </Section>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default DocumentPendingEmailTemplate;
