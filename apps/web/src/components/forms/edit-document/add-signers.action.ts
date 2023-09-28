'use server';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { setRecipientsForDocument } from '@documenso/lib/server-only/recipient/set-recipients-for-document';
import { TAddSignersFormSchema } from '@documenso/ui/primitives/document-flow/add-signers.types';

export type AddSignersActionInput = TAddSignersFormSchema & {
  documentId: number;
};

export const addSigners = async ({ documentId, signers }: AddSignersActionInput) => {
  'use server';

  const { user } = await getRequiredServerComponentSession();

  await setRecipientsForDocument({
    userId: user.id,
    documentId,
    recipients: signers.map((signer) => ({
      id: signer.nativeId,
      email: signer.email,
      name: signer.name,
    })),
  });
};
