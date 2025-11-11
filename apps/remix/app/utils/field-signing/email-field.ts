import { FieldType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldEmail } from '@documenso/lib/types/field';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';

import { SignFieldEmailDialog } from '~/components/dialogs/sign-field-email-dialog';

type HandleEmailFieldClickOptions = {
  field: TFieldEmail;
  email: string | null;
  placeholderEmail: string | null;
};

export const handleEmailFieldClick = async (
  options: HandleEmailFieldClickOptions,
): Promise<Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.EMAIL }> | null> => {
  const { field, email, placeholderEmail } = options;

  if (field.type !== FieldType.EMAIL) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid field type',
    });
  }

  if (field.inserted) {
    return {
      type: FieldType.EMAIL,
      value: null,
    };
  }

  let emailToInsert = email;

  if (!emailToInsert) {
    emailToInsert = await SignFieldEmailDialog.call({
      placeholderEmail,
    });
  }

  if (!emailToInsert) {
    return null;
  }

  return {
    type: FieldType.EMAIL,
    value: emailToInsert,
  };
};
