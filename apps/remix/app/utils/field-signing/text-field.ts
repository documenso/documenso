import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldText } from '@documenso/lib/types/field';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { FieldType } from '@prisma/client';

import { SignFieldTextDialog } from '~/components/dialogs/sign-field-text-dialog';

type HandleTextFieldClickOptions = {
  field: TFieldText;
  text: string | null;
};

export const handleTextFieldClick = async (
  options: HandleTextFieldClickOptions,
): Promise<Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.TEXT }> | null> => {
  const { field, text } = options;

  if (field.type !== FieldType.TEXT) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid field type',
    });
  }

  let textToInsert = text;

  if (!textToInsert) {
    textToInsert = await SignFieldTextDialog.call({
      fieldMeta: field.fieldMeta,
      defaultValue: field.inserted ? field.customText : undefined,
    });
  }

  if (textToInsert === null) {
    return null;
  }

  // An empty value clears the field.
  return {
    type: FieldType.TEXT,
    value: textToInsert || null,
  };
};
