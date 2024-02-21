import { prisma } from '@documenso/prisma';
import type { RecipientRole } from '@documenso/prisma/client';

export type UpdateRecipientOptions = {
  documentId: number;
  recipientId: number;
  email?: string;
  name?: string;
  role?: RecipientRole;
};

export const updateRecipient = async ({
  documentId,
  recipientId,
  email,
  name,
  role,
}: UpdateRecipientOptions) => {
  const recipient = await prisma.recipient.findFirst({
    where: {
      id: recipientId,
      documentId,
    },
  });

  if (!recipient) {
    throw new Error('Recipient not found');
  }

  const updatedRecipient = await prisma.recipient.update({
    where: {
      id: recipient.id,
    },
    data: {
      email: email?.toLowerCase() ?? recipient.email,
      name: name ?? recipient.name,
      role: role ?? recipient.role,
    },
  });

  return updatedRecipient;
};
