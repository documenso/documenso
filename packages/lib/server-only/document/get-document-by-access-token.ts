import { prisma } from '@documenso/prisma';

export type GetDocumentByAccessTokenOptions = {
  token: string;
};

export const getDocumentByAccessToken = async ({ token }: GetDocumentByAccessTokenOptions) => {
  if (!token) {
    throw new Error('Missing token');
  }

  const result = await prisma.documentAccessToken.findFirstOrThrow({
    where: {
      token,
    },
    include: {
      document: {
        include: {
          documentData: true,
          documentMeta: true,
        },
      },
    },
  });

  return result;
};
