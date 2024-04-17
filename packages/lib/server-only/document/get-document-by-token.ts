import { prisma } from '@documenso/prisma';
<<<<<<< HEAD
import { DocumentWithRecipient } from '@documenso/prisma/types/document-with-recipient';

export interface GetDocumentAndSenderByTokenOptions {
  token: string;
=======
import type { DocumentWithRecipient } from '@documenso/prisma/types/document-with-recipient';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { TDocumentAuthMethods } from '../../types/document-auth';
import { isRecipientAuthorized } from './is-recipient-authorized';

export interface GetDocumentAndSenderByTokenOptions {
  token: string;
  userId?: number;
  accessAuth?: TDocumentAuthMethods;

  /**
   * Whether we enforce the access requirement.
   *
   * Defaults to true.
   */
  requireAccessAuth?: boolean;
>>>>>>> main
}

export interface GetDocumentAndRecipientByTokenOptions {
  token: string;
<<<<<<< HEAD
}

export const getDocumentAndSenderByToken = async ({
  token,
=======
  userId?: number;
  accessAuth?: TDocumentAuthMethods;

  /**
   * Whether we enforce the access requirement.
   *
   * Defaults to true.
   */
  requireAccessAuth?: boolean;
}
export type GetDocumentByTokenOptions = {
  token: string;
};

export const getDocumentByToken = async ({ token }: GetDocumentByTokenOptions) => {
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
  });

  return result;
};

export type DocumentAndSender = Awaited<ReturnType<typeof getDocumentAndSenderByToken>>;

export const getDocumentAndSenderByToken = async ({
  token,
  userId,
  accessAuth,
  requireAccessAuth = true,
>>>>>>> main
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
<<<<<<< HEAD
=======
      documentMeta: true,
      Recipient: {
        where: {
          token,
        },
      },
>>>>>>> main
    },
  });

  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
  const { password: _password, ...User } = result.User;

<<<<<<< HEAD
=======
  const recipient = result.Recipient[0];

  // Sanity check, should not be possible.
  if (!recipient) {
    throw new Error('Missing recipient');
  }

  let documentAccessValid = true;

  if (requireAccessAuth) {
    documentAccessValid = await isRecipientAuthorized({
      type: 'ACCESS',
      document: result,
      recipient,
      userId,
      authOptions: accessAuth,
    });
  }

  if (!documentAccessValid) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, 'Invalid access values');
  }

>>>>>>> main
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
<<<<<<< HEAD
=======
  userId,
  accessAuth,
  requireAccessAuth = true,
>>>>>>> main
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
<<<<<<< HEAD
      Recipient: true,
=======
      Recipient: {
        where: {
          token,
        },
      },
>>>>>>> main
      documentData: true,
    },
  });

<<<<<<< HEAD
  return {
    ...result,
    Recipient: result.Recipient[0],
=======
  const recipient = result.Recipient[0];

  // Sanity check, should not be possible.
  if (!recipient) {
    throw new Error('Missing recipient');
  }

  let documentAccessValid = true;

  if (requireAccessAuth) {
    documentAccessValid = await isRecipientAuthorized({
      type: 'ACCESS',
      document: result,
      recipient,
      userId,
      authOptions: accessAuth,
    });
  }

  if (!documentAccessValid) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, 'Invalid access values');
  }

  return {
    ...result,
    Recipient: result.Recipient,
>>>>>>> main
  };
};
