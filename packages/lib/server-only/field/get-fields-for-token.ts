import { prisma } from '@documenso/prisma';

export type GetFieldsForTokenOptions = {
  token: string;
};

export const getFieldsForToken = async ({ token }: GetFieldsForTokenOptions) => {
  return await prisma.field.findMany({
    where: {
      recipient: {
        token,
      },
    },
    include: {
      signature: true,
    },
  });
};
