import { prisma } from '@documenso/prisma';
import { SigningStatus } from '@documenso/prisma/client';

export type UpdateRecipientOptions = {
  id: number;
  name: string | undefined;
  email: string | undefined;
};

export const updateRecipient = async ({ id, name, email }: UpdateRecipientOptions) => {
  const recipient = await prisma.recipient.findFirstOrThrow({
    where: {
      id,
    },
  });

  if (recipient.signingStatus === SigningStatus.SIGNED) {
    throw new Error('Cannot update a recipient that has already signed.');
  }

  return await prisma.recipient.update({
    where: {
      id,
    },
    data: {
      name,
      email,
    },
  });
};
