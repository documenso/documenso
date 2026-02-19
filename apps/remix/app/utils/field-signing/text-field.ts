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

  if (field.inserted) {
    return {
      type: FieldType.TEXT,
      value: null,
    };
  }

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

  return {
    type: FieldType.TEXT,
    value: textToInsert,
  };
};
