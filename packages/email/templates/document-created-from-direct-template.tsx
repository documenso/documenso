import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import config from '@documenso/tailwind-config';

import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text,
} from '../components';
import TemplateDocumentImage from '../template-components/template-document-image';
import { TemplateFooter } from '../template-components/template-footer';
import { RecipientRole } from '.prisma/client';

export type DocumentCompletedEmailTemplateProps = {
  recipientName?: string;
  recipientRole?: RecipientRole;
  documentLink?: string;
  documentName?: string;
  assetBaseUrl?: string;
};

export const DocumentCreatedFromDirectTemplateEmailTemplate = ({
  recipientName = 'John Doe',
  recipientRole = RecipientRole.SIGNER,
  documentLink = 'http://localhost:3000',
  documentName = 'Open Source Pledge.pdf',
  assetBaseUrl = 'http://localhost:3002',
}: DocumentCompletedEmailTemplateProps) => {
  const action = RECIPIENT_ROLES_DESCRIPTION[recipientRole].actioned.toLowerCase();

  const previewText = `Document created from direct template`;

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

                <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

                <Section>
                  <Text className="text-primary mb-0 text-center text-lg font-semibold">
                    {recipientName} {action} a document by using one of your direct links
                  </Text>

                  <div className="mx-auto my-2 w-fit rounded-lg bg-gray-50 px-4 py-2 text-sm text-slate-600">
                    {documentName}
                  </div>

                  <Section className="my-6 text-center">
                    <Button
                      className="bg-documenso-500 inline-flex items-center justify-center rounded-lg px-6 py-3 text-center text-sm font-medium text-black no-underline"
                      href={documentLink}
                    >
                      View document
                    </Button>
                  </Section>
                </Section>
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

export default DocumentCreatedFromDirectTemplateEmailTemplate;
