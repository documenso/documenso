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

  if (text && !field.inserted) {
    return {
      type: FieldType.TEXT,
      value: text,
    };
  }

  // Inserted fields reopen the dialog with their current text so it can be edited or removed.
  const result = await SignFieldTextDialog.call({
    fieldMeta: field.fieldMeta,
    insertedText: field.inserted ? field.customText : undefined,
  });

  if (!result) {
    return null;
  }

  if (result.action === 'remove') {
    return {
      type: FieldType.TEXT,
      value: null,
    };
  }

  // Avoid re-signing the field when the text has not changed.
  if (field.inserted && result.text === field.customText) {
    return null;
  }

  return {
    type: FieldType.TEXT,
    value: result.text,
  };
};
