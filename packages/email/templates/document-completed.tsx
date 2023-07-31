import {
  Body,
  Button,
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

interface DocumentCompletedEmailTemplateProps {
  downloadLink?: string;
  reviewLink?: string;
  documentName?: string;
  assetBaseUrl?: string;
}

export const DocumentCompletedEmailTemplate = ({
  downloadLink = 'https://documenso.com',
  reviewLink = 'https://documenso.com',
  documentName = 'Open Source Pledge.pdf',
  assetBaseUrl = 'http://localhost:3002',
}: DocumentCompletedEmailTemplateProps) => {
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
                <Img src={getAssetUrl('/static/logo.png')} alt="Documenso Logo" className="h-6" />

                <Section className="mt-4 flex-row items-center justify-center">
                  <div className="flex items-center justify-center p-4">
                    <Img
                      className="h-42"
                      src={getAssetUrl('/static/document.png')}
                      alt="Documenso"
                    />
                  </div>

                  <Text className="mb-4 flex items-center justify-center text-center text-base font-semibold text-[#7AC455]">
                    <Img
                      src={getAssetUrl('/static/completed.png')}
                      className="-mb-0.5 mr-2 inline h-7 w-7"
                    />
                    Completed
                  </Text>

                  <Text className="text-primary mb-0 text-center text-lg font-semibold">
                    “{documentName}” was signed by all signers
                  </Text>

                  <Text className="my-1 text-center text-base text-slate-400">
                    Continue by downloading or reviewing the document.
                  </Text>

                  <Section className="mb-6 mt-8 text-center">
                    <Button
                      className="mr-4 inline-flex items-center justify-center rounded-lg border border-solid border-slate-200 px-4 py-2 text-center text-sm font-medium text-black no-underline"
                      href={reviewLink}
                    >
                      <Img
                        src={getAssetUrl('/static/review.png')}
                        className="-mb-1 mr-2 inline h-5 w-5"
                      />
                      Review
                    </Button>
                    <Button
                      className="inline-flex items-center justify-center rounded-lg border border-solid border-slate-200 px-4 py-2 text-center text-sm font-medium text-black no-underline"
                      href={downloadLink}
                    >
                      <Img
                        src={getAssetUrl('/static/download.png')}
                        className="-mb-1 mr-2 inline h-5 w-5"
                      />
                      Download
                    </Button>
                  </Section>
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

export default DocumentCompletedEmailTemplate;
