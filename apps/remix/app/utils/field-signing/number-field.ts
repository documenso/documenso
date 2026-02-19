import { FieldType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldNumber } from '@documenso/lib/types/field';
import { ZNumberFieldMeta } from '@documenso/lib/types/field-meta';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';

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

  if (field.inserted) {
    return {
      type: FieldType.NUMBER,
      value: null,
    };
  }

  let numberToInsert = number;

  if (!numberToInsert) {
    const parsedMeta = ZNumberFieldMeta.safeParse(field.fieldMeta);
    const initialValue =
      field.customText ?? (parsedMeta.success ? parsedMeta.data.value : undefined);

    numberToInsert = await SignFieldNumberDialog.call({
      fieldMeta: field.fieldMeta,
      initialValue: initialValue ?? undefined,
    });
  }

  if (!numberToInsert) {
    return null;
  }

  return {
    type: FieldType.NUMBER,
    value: numberToInsert,
  };
};
