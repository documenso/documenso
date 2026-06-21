import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldHighlight } from '@documenso/lib/types/field';
import type { THighlightFieldMeta } from '@documenso/lib/types/field-meta';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { FieldType } from '@prisma/client';

import { SignFieldHighlightDialog } from '~/components/dialogs/sign-field-highlight-dialog';

type HandleHighlightFieldClickOptions = {
  field: TFieldHighlight;
};

export const handleHighlightFieldClick = async (
  options: HandleHighlightFieldClickOptions,
): Promise<Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.HIGHLIGHT }> | null> => {
  const { field } = options;

  if (field.type !== FieldType.HIGHLIGHT) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid field type',
    });
  }

  const existingHighlights = field.fieldMeta?.highlights || [];

  if (existingHighlights.length > 0) {
    return {
      type: FieldType.HIGHLIGHT,
      value: existingHighlights,
    };
  }

  const result = await SignFieldHighlightDialog.call({});

  if (!result) {
    return null;
  }

  // The actual highlight data will be collected by the text selection overlay
  // after the dialog closes. This handler initializes the process.
  return {
    type: FieldType.HIGHLIGHT,
    value: [],
  };
};