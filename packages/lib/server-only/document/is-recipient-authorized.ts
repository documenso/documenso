import { match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';
import type { Document, Recipient } from '@documenso/prisma/client';

import type { TDocumentAuth, TDocumentAuthMethods } from '../../types/document-auth';
import { DocumentAuth } from '../../types/document-auth';
import { extractDocumentAuthMethods } from '../../utils/document-auth';

type IsRecipientAuthorizedOptions = {
  type: 'ACCESS' | 'ACTION';
  document: Document;
  recipient: Recipient;

  /**
   * The ID of the user who initiated the request.
   */
  userId?: number;

  /**
   * The auth details to check.
   *
   * Optional because there are scenarios where no auth options are required such as
   * using the user ID.
   */
  authOptions?: TDocumentAuthMethods;
};

const getUserByEmail = async (email: string) => {
  return await prisma.user.findFirst({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });
};

/**
 * Whether the recipient is authorized to perform the requested operation on a
 * document, given the provided auth options.
 *
 * @returns True if the recipient can perform the requested operation.
 */
export const isRecipientAuthorized = async ({
  type,
  document,
  recipient,
  userId,
  authOptions,
}: IsRecipientAuthorizedOptions): Promise<boolean> => {
  const { derivedRecipientAccessAuth, derivedRecipientActionAuth } = extractDocumentAuthMethods({
    documentAuth: document.authOptions,
    recipientAuth: recipient.authOptions,
  });

  const authMethod: TDocumentAuth | null =
    type === 'ACCESS' ? derivedRecipientAccessAuth : derivedRecipientActionAuth;

  // Early true return when auth is not required.
  if (!authMethod || authMethod === DocumentAuth.EXPLICIT_NONE) {
    return true;
  }

  // Authentication required does not match provided method.
  if (authOptions && authOptions.type !== authMethod) {
    return false;
  }

  return await match(authMethod)
    .with(DocumentAuth.ACCOUNT, async () => {
      if (userId === undefined) {
        return false;
      }

      const recipientUser = await getUserByEmail(recipient.email);

      if (!recipientUser) {
        return false;
      }

      return recipientUser.id === userId;
    })
    .exhaustive();
};
