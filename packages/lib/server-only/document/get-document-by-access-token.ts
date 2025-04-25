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
    select: {
      document: {
        select: {
          title: true,
          documentData: {
            select: {
              id: true,
              type: true,
              data: true,
              initialData: true,
            },
          },
          documentMeta: {
            select: {
              password: true,
            },
          },
        },
      },
    },
  });

  return result;
};
