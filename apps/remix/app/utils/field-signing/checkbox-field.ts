import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldCheckbox } from '@documenso/lib/types/field';
import { parseCheckboxCustomText } from '@documenso/lib/utils/fields';
import type { TSignEnvelopeFieldValues } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { FieldType } from '@prisma/client';

type HandleCheckboxFieldClickOptions = {
  field: TFieldCheckbox;
  clickedCheckboxIndex: number;
};

/**
 * Resolves the values to sign when a checkbox option is clicked.
 *
 * The option is simply toggled. Validation rules are not enforced here, they are
 * enforced when the recipient completes the document.
 */
export const handleCheckboxFieldClick = ({
  field,
  clickedCheckboxIndex,
}: HandleCheckboxFieldClickOptions): TSignEnvelopeFieldValues => {
  if (field.type !== FieldType.CHECKBOX) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid field type',
    });
  }

  const currentCheckedIndices: number[] = field.customText ? parseCheckboxCustomText(field.customText) : [];

  const selectedIndices = currentCheckedIndices.includes(clickedCheckboxIndex)
    ? currentCheckedIndices.filter((index) => index !== clickedCheckboxIndex)
    : [...currentCheckedIndices, clickedCheckboxIndex].sort((a, b) => a - b);

  return [
    {
      fieldId: field.id,
      fieldValue: {
        type: FieldType.CHECKBOX,
        value: selectedIndices,
      },
    },
  ];
};
