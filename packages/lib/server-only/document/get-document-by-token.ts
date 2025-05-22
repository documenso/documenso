import { prisma } from '@documenso/prisma';
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
}

export interface GetDocumentAndRecipientByTokenOptions {
  token: string;
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
      recipients: {
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
}: GetDocumentAndSenderByTokenOptions) => {
  if (!token) {
    throw new Error('Missing token');
  }

  const result = await prisma.document.findFirstOrThrow({
    where: {
      recipients: {
        some: {
          token,
        },
      },
    },
    include: {
      user: true,
      documentData: true,
      documentMeta: true,
      recipients: {
        where: {
          token,
        },
      },
      team: {
        select: {
          name: true,
          teamEmail: true,
          // Todo: orgs, where does this lead to?
          teamGlobalSettings: {
            select: {
              includeSenderDetails: true,
            },
          },
        },
      },
    },
  });

  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
  const { password: _password, ...user } = result.user;

  const recipient = result.recipients[0];

  // Sanity check, should not be possible.
  if (!recipient) {
    throw new Error('Missing recipient');
  }

  let documentAccessValid = true;

  if (requireAccessAuth) {
    documentAccessValid = await isRecipientAuthorized({
      type: 'ACCESS',
      documentAuthOptions: result.authOptions,
      recipient,
      userId,
      authOptions: accessAuth,
    });
  }

  if (!documentAccessValid) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Invalid access values',
    });
  }

  return {
    ...result,
    user,
  };
};

/**
 * Get a Document and a Recipient by the recipient token.
 */
export const getDocumentAndRecipientByToken = async ({
  token,
  userId,
  accessAuth,
  requireAccessAuth = true,
}: GetDocumentAndRecipientByTokenOptions): Promise<DocumentWithRecipient> => {
  if (!token) {
    throw new Error('Missing token');
  }

  const result = await prisma.document.findFirstOrThrow({
    where: {
      recipients: {
        some: {
          token,
        },
      },
    },
    include: {
      recipients: {
        where: {
          token,
        },
      },
      documentData: true,
    },
  });

  const [recipient] = result.recipients;

  // Sanity check, should not be possible.
  if (!recipient) {
    throw new Error('Missing recipient');
  }

  let documentAccessValid = true;

  if (requireAccessAuth) {
    documentAccessValid = await isRecipientAuthorized({
      type: 'ACCESS',
      documentAuthOptions: result.authOptions,
      recipient,
      userId,
      authOptions: accessAuth,
    });
  }

  if (!documentAccessValid) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Invalid access values',
    });
  }

  return result;
};
