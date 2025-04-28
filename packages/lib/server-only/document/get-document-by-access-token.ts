import { prisma } from '@documenso/prisma';

export type GetDocumentByAccessTokenOptions = {
  token: string;
};

export const getDocumentByAccessToken = async ({ token }: GetDocumentByAccessTokenOptions) => {
  if (!token) {
    throw new Error('Missing token');
  }

  const result = await prisma.document.findFirstOrThrow({
    where: {
      qrToken: token,
    },
    select: {
      id: true,
      title: true,
      completedAt: true,
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
      recipients: true,
    },
  });

  return result;
};
