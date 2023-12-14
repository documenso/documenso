'use server';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { setRecipientsForTemplate } from '@documenso/lib/server-only/recipient/set-recipients-for-template';
import type { TAddTemplatePlacholderRecipientsFormSchema } from '@documenso/ui/primitives/template-flow/add-template-placeholder-recipients.types';

export type AddTemplatePlaceholdersActionInput = TAddTemplatePlacholderRecipientsFormSchema & {
  templateId: number;
};

export const addTemplatePlaceholders = async ({
  templateId,
  signers,
}: AddTemplatePlaceholdersActionInput) => {
  'use server';

  const { user } = await getRequiredServerComponentSession();

  await setRecipientsForTemplate({
    userId: user.id,
    templateId,
    recipients: signers.map((signer) => ({
      id: signer.nativeId!,
      email: signer.email,
      name: signer.name!,
    })),
  });
};
