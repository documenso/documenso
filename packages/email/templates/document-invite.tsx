import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';

import * as config from '@documenso/tailwind-config';

interface DocumentInviteEmailTemplateProps {
  inviterName?: string;
  inviterEmail?: string;
  documentName?: string;
  signDocumentLink?: string;
  assetBaseUrl?: string;
}

export const DocumentInviteEmailTemplate = ({
  inviterName = 'Lucas Smith',
  inviterEmail = 'lucas@documenso.com',
  documentName = 'Open Source Pledge.pdf',
  signDocumentLink = 'https://documenso.com',
  assetBaseUrl = 'http://localhost:3002',
}: DocumentInviteEmailTemplateProps) => {
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
        <Body className="mx-auto my-auto bg-white font-sans">
          <Section>
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

                  <Text className="text-primary mx-auto mb-0 max-w-[80%] text-center text-lg font-semibold">
                    {inviterName} has invited you to sign "{documentName}"
                  </Text>

                  <Text className="my-1 text-center text-base text-slate-400">
                    Continue by signing the document.
                  </Text>

                  <Section className="mb-6 mt-8 text-center">
                    <Button
                      className="bg-documenso-500 inline-flex items-center justify-center rounded-lg px-6 py-3 text-center text-sm font-medium text-black no-underline"
                      href={signDocumentLink}
                    >
                      Sign Document
                    </Button>
                  </Section>
                </Section>
              </Section>
            </Container>

            <Container className="mx-auto mt-12 max-w-xl">
              <Section>
                <Text className="my-4 text-base font-semibold">
                  {inviterName}{' '}
                  <Link className="font-normal text-slate-400" href="mailto:{inviterEmail}">
                    ({inviterEmail})
                  </Link>
                </Text>

                <Text className="mt-2 text-base text-slate-400">
                  {inviterName} has invited you to sign the document "{documentName}".
                </Text>
              </Section>
            </Container>

            <Hr className="mx-auto mt-12 max-w-xl" />

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

export default DocumentInviteEmailTemplate;
