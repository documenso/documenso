import { prisma } from '@documenso/prisma';

export type GetFieldByEmailOptions = {
  documentId: number;
  email: string;
};

// TODO: get rid of this thing
export const getFieldByEmail = async ({ documentId, email }: GetFieldByEmailOptions) => {
  const field = await prisma.field.findFirst({
    where: {
      Recipient: {
        email,
      },
      documentId,
    },
  });

  return field;
};
