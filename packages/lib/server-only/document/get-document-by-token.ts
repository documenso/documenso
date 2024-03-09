import { prisma } from '@documenso/prisma';
import type { DocumentWithRecipient } from '@documenso/prisma/types/document-with-recipient';

export interface GetDocumentAndSenderByTokenOptions {
  token: string;
}

export interface GetDocumentAndRecipientByTokenOptions {
  token: string;
}

export const getDocumentAndSenderByToken = async ({
  token,
}: GetDocumentAndSenderByTokenOptions) => {
  if (!token) {
    throw new Error('Missing token');
  }

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
      documentMeta: true,
    },
  });

  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
  const { password: _password, ...User } = result.User;

  return {
    ...result,
    User,
  };
};

/**
 * Get a Document and a Recipient by the recipient token.
 */
export const getDocumentAndRecipientByToken = async ({
  token,
}: GetDocumentAndRecipientByTokenOptions): Promise<DocumentWithRecipient> => {
  if (!token) {
    throw new Error('Missing token');
  }

  const result = await prisma.document.findFirstOrThrow({
    where: {
      Recipient: {
        some: {
          token,
        },
      },
    },
    include: {
      Recipient: {
        where: {
          token,
        },
      },
      documentData: true,
    },
  });

  return {
    ...result,
    Recipient: result.Recipient,
  };
};
