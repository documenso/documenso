import type { Envelope, Field, Recipient } from '@prisma/client';
import { FieldType } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { TRecipientActionAuth } from '../../types/document-auth';
import { isRecipientAuthorized } from './is-recipient-authorized';

export type ValidateFieldAuthOptions = {
  documentAuthOptions: Envelope['authOptions'];
  recipient: Pick<Recipient, 'authOptions' | 'email' | 'envelopeId'>;
  field: Field;
  userId?: number;
  authOptions?: TRecipientActionAuth;
};

/**
 * Throws an error if the reauth for a field is invalid.
 *
 * Returns the derived recipient action authentication if valid.
 */
export const validateFieldAuth = async ({
  documentAuthOptions,
  recipient,
  field,
  userId,
  authOptions,
}: ValidateFieldAuthOptions) => {
  // Override all non-signature fields to not require any auth.
  if (field.type !== FieldType.SIGNATURE) {
    return undefined;
  }

  const isValid = await isRecipientAuthorized({
    type: 'ACTION',
    documentAuthOptions,
    recipient,
    userId,
    authOptions,
  });

  if (!isValid) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Invalid authentication values',
    });
  }

  return authOptions?.type;
};
