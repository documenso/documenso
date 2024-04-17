<<<<<<< HEAD
import { Button, Section, Tailwind, Text } from '@react-email/components';

import * as config from '@documenso/tailwind-config';

=======
import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import type { RecipientRole } from '@documenso/prisma/client';

import { Button, Section, Text } from '../components';
>>>>>>> main
import { TemplateDocumentImage } from './template-document-image';

export interface TemplateDocumentInviteProps {
  inviterName: string;
  inviterEmail: string;
  documentName: string;
  signDocumentLink: string;
  assetBaseUrl: string;
<<<<<<< HEAD
=======
  role: RecipientRole;
>>>>>>> main
}

export const TemplateDocumentInvite = ({
  inviterName,
  documentName,
  signDocumentLink,
  assetBaseUrl,
<<<<<<< HEAD
}: TemplateDocumentInviteProps) => {
  return (
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: config.theme.extend.colors,
          },
        },
      }}
    >
=======
  role,
}: TemplateDocumentInviteProps) => {
  const { actionVerb, progressiveVerb } = RECIPIENT_ROLES_DESCRIPTION[role];

  return (
    <>
>>>>>>> main
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Section>
        <Text className="text-primary mx-auto mb-0 max-w-[80%] text-center text-lg font-semibold">
<<<<<<< HEAD
          {inviterName} has invited you to sign
=======
          {inviterName} has invited you to {actionVerb.toLowerCase()}
>>>>>>> main
          <br />"{documentName}"
        </Text>

        <Text className="my-1 text-center text-base text-slate-400">
<<<<<<< HEAD
          Continue by signing the document.
=======
          Continue by {progressiveVerb.toLowerCase()} the document.
>>>>>>> main
        </Text>

        <Section className="mb-6 mt-8 text-center">
          <Button
            className="bg-documenso-500 inline-flex items-center justify-center rounded-lg px-6 py-3 text-center text-sm font-medium text-black no-underline"
            href={signDocumentLink}
          >
<<<<<<< HEAD
            Sign Document
          </Button>
        </Section>
      </Section>
    </Tailwind>
=======
            {actionVerb} Document
          </Button>
        </Section>
      </Section>
    </>
>>>>>>> main
  );
};

export default TemplateDocumentInvite;
