import { prisma } from '@documenso/prisma';

export type GetEntireDocumentOptions = {
  id: number;
};

export const getEntireDocument = async ({ id }: GetEntireDocumentOptions) => {
  const document = await prisma.document.findFirstOrThrow({
    where: {
      id,
    },
    include: {
      documentMeta: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      recipients: {
        include: {
          fields: {
            include: {
              signature: true,
            },
          },
        },
      },
    },
  });

  return document;
};
