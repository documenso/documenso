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
      Recipient: {
        include: {
          Field: {
            include: {
              Signature: true,
            },
          },
        },
      },
    },
  });

  return document;
};
