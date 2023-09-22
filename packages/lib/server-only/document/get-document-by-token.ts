import { prisma } from '@documenso/prisma';

export interface GetDocumentAndSenderByTokenOptions {
  token: string;
}

export const getDocumentAndSenderByToken = async ({
  token,
}: GetDocumentAndSenderByTokenOptions) => {
  const result = await prisma.document.findFirstOrThrow({
    where: {
      Recipient: {
        some: {
          token,
        },
      },
    },
    include: {
      User: true,
      documentData: true,
    },
  });

  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
  const { password: _password, ...User } = result.User;

  return {
    ...result,
    User,
  };
};
