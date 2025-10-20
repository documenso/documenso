import { FieldType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldName } from '@documenso/lib/types/field';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';

import { SignFieldNameDialog } from '~/components/dialogs/sign-field-name-dialog';

type HandleNameFieldClickOptions = {
  field: TFieldName;
  name: string | null;
};

export const handleNameFieldClick = async (
  options: HandleNameFieldClickOptions,
): Promise<Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.NAME }> | null> => {
  const { field, name } = options;

  if (field.type !== FieldType.NAME) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid field type',
    });
  }

  if (field.inserted) {
    return {
      type: FieldType.NAME,
      value: null,
    };
  }

  let nameToInsert = name;

  if (!nameToInsert) {
    nameToInsert = await SignFieldNameDialog.call({
      // Props here.
    });
  }

  if (!nameToInsert) {
    return null;
  }

  return {
    type: FieldType.NAME,
    value: nameToInsert,
  };
};
