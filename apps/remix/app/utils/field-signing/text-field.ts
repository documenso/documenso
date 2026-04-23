import { FieldType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldText } from '@documenso/lib/types/field';
import { ZTextFieldMeta } from '@documenso/lib/types/field-meta';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';

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

  // When field is already inserted, open dialog to edit (with current value) instead of unsigning.
  // This preserves the user's entered value when they click the field again.
  let textToInsert = text;

  if (!textToInsert) {
    const parsedMeta = ZTextFieldMeta.safeParse(field.fieldMeta);
    const initialValue =
      field.customText ?? (parsedMeta.success ? parsedMeta.data.text : undefined);

    textToInsert = await SignFieldTextDialog.call({
      fieldMeta: field.fieldMeta,
      initialValue: initialValue ?? undefined,
    });
  }

  if (!textToInsert) {
    return null;
  }

  // If user cleared the value and field was inserted, treat as unsign.
  if (field.inserted && textToInsert.trim() === '') {
    return {
      type: FieldType.TEXT,
      value: null,
    };
  }

  return {
    type: FieldType.TEXT,
    value: textToInsert,
  };
};
