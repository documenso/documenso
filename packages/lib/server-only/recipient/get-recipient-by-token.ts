import { prisma } from '@documenso/prisma';

export interface GetRecipientByTokenOptions {
  token: string;
}

export const getRecipientByToken = async ({ token }: GetRecipientByTokenOptions) => {
  return await prisma.recipient.findFirstOrThrow({
    where: {
      token,
    },
  });
};
