'use server';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { setRecipientsForTemplate } from '@documenso/lib/server-only/recipient/set-recipients-for-template';
import { TAddTemplatePlacholderRecipientsFormSchema } from '@documenso/ui/primitives/document-flow/add-template-placeholder-recipients.types';

export type AddTemmplatePlaceholdersActionInput = TAddTemplatePlacholderRecipientsFormSchema & {
  templateId: number;
};

export const addTemplatePlaceholders = async ({
  templateId,
  signers,
}: AddTemmplatePlaceholdersActionInput) => {
  'use server';

  const { user } = await getRequiredServerComponentSession();

  await setRecipientsForTemplate({
    userId: user.id,
    templateId,
    recipients: signers.map((signer) => ({
      id: signer.nativeId,
      email: signer.email,
      placeholder: signer.name,
    })),
  });
};
