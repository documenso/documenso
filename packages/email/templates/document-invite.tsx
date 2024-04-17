<<<<<<< HEAD
=======
import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import type { RecipientRole } from '@documenso/prisma/client';
import config from '@documenso/tailwind-config';

>>>>>>> main
import {
  Body,
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
<<<<<<< HEAD
} from '@react-email/components';

import config from '@documenso/tailwind-config';

import {
  TemplateDocumentInvite,
  TemplateDocumentInviteProps,
} from '../template-components/template-document-invite';
=======
} from '../components';
import type { TemplateDocumentInviteProps } from '../template-components/template-document-invite';
import { TemplateDocumentInvite } from '../template-components/template-document-invite';
>>>>>>> main
import { TemplateFooter } from '../template-components/template-footer';

export type DocumentInviteEmailTemplateProps = Partial<TemplateDocumentInviteProps> & {
  customBody?: string;
<<<<<<< HEAD
=======
  role: RecipientRole;
>>>>>>> main
};

export const DocumentInviteEmailTemplate = ({
  inviterName = 'Lucas Smith',
  inviterEmail = 'lucas@documenso.com',
  documentName = 'Open Source Pledge.pdf',
  signDocumentLink = 'https://documenso.com',
  assetBaseUrl = 'http://localhost:3002',
  customBody,
<<<<<<< HEAD
}: DocumentInviteEmailTemplateProps) => {
  const previewText = `Completed Document`;
=======
  role,
}: DocumentInviteEmailTemplateProps) => {
  const action = RECIPIENT_ROLES_DESCRIPTION[role].actionVerb.toLowerCase();

  const previewText = `${inviterName} has invited you to ${action} ${documentName}`;
>>>>>>> main

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

                <TemplateDocumentInvite
                  inviterName={inviterName}
                  inviterEmail={inviterEmail}
                  documentName={documentName}
                  signDocumentLink={signDocumentLink}
                  assetBaseUrl={assetBaseUrl}
<<<<<<< HEAD
=======
                  role={role}
>>>>>>> main
                />
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
                  {customBody ? (
                    <pre className="font-sans text-base text-slate-400">{customBody}</pre>
                  ) : (
<<<<<<< HEAD
                    `${inviterName} has invited you to sign the document "${documentName}".`
=======
                    `${inviterName} has invited you to ${action} the document "${documentName}".`
>>>>>>> main
                  )}
                </Text>
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

export default DocumentInviteEmailTemplate;
