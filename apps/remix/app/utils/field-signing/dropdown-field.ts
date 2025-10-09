import { FieldType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldDropdown } from '@documenso/lib/types/field';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';

import { SignFieldDropdownDialog } from '~/components/dialogs/sign-field-dropdown-dialog';

type HandleDropdownFieldClickOptions = {
  field: TFieldDropdown;
  text: string | null;
};

export const handleDropdownFieldClick = async (
  options: HandleDropdownFieldClickOptions,
): Promise<Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.DROPDOWN }> | null> => {
  const { field, text } = options;

  if (field.type !== FieldType.DROPDOWN || !field.fieldMeta) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid field type',
    });
  }

  if (field.inserted) {
    return {
      type: FieldType.DROPDOWN,
      value: null,
    };
  }

  let textToInsert = text;

  if (!textToInsert) {
    textToInsert = await SignFieldDropdownDialog.call({
      fieldMeta: field.fieldMeta,
    });
  }

  if (!textToInsert) {
    return null;
  }

  return {
    type: FieldType.DROPDOWN,
    value: textToInsert,
  };
};
