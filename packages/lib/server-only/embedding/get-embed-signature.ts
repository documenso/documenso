import { prisma } from '@documenso/prisma';

import { createEmbedSignatureKey } from './create-embed-signature-key';

export type GetEmbedSignatureOptions = {
  organisationId: string;
  email: string;
  clientUserId: string;
};

export const getEmbedSignature = async ({ organisationId, email, clientUserId }: GetEmbedSignatureOptions) => {
  const key = createEmbedSignatureKey({ organisationId, email, clientUserId });

  const embedSignature = await prisma.embedSignature.findUnique({
    where: {
      key,
    },
    select: {
      signature: true,
    },
  });

  return embedSignature?.signature ?? null;
};
