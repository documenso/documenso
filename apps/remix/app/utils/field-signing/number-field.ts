import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldNumber } from '@documenso/lib/types/field';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { FieldType } from '@prisma/client';

import { SignFieldNumberDialog } from '~/components/dialogs/sign-field-number-dialog';

type HandleNumberFieldClickOptions = {
  field: TFieldNumber;
  number: string | null;
};

export const handleNumberFieldClick = async (
  options: HandleNumberFieldClickOptions,
): Promise<Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.NUMBER }> | null> => {
  const { field, number } = options;

  if (field.type !== FieldType.NUMBER) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid field type',
    });
  }

  if (number && !field.inserted) {
    return {
      type: FieldType.NUMBER,
      value: number,
    };
  }

  // Inserted fields reopen the dialog with their current number so it can be edited or removed.
  const result = await SignFieldNumberDialog.call({
    fieldMeta: field.fieldMeta,
    insertedNumber: field.inserted ? field.customText : undefined,
  });

  if (!result) {
    return null;
  }

  if (result.action === 'remove') {
    return {
      type: FieldType.NUMBER,
      value: null,
    };
  }

  // Avoid re-signing the field when the number has not changed.
  if (field.inserted && result.number === field.customText) {
    return null;
  }

  return {
    type: FieldType.NUMBER,
    value: result.number,
  };
};
