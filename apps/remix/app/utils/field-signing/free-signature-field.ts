import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldSignature } from '@documenso/lib/types/field';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import type { FieldType } from '@prisma/client';
import { SignFieldImageRemoveConfirmationDialog } from '~/components/dialogs/sign-field-image-remove-confirmation-dialog';
import { SignFieldImageUploadDialog } from '~/components/dialogs/sign-field-image-upload-dialog';

type HandleFreeSignatureFieldClickOptions = {
  field: TFieldSignature;
  initialSignature?: string;
};

export const handleImageUploadFieldClick = async (
  options: HandleFreeSignatureFieldClickOptions,
): Promise<Extract<TSignEnvelopeFieldValue, { type: FieldType.IMAGE_UPLOAD }> | null> => {
  const { field, initialSignature } = options;

  if (field.type !== 'IMAGE_UPLOAD') {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid field type',
    });
  }

  if (initialSignature) {
    const shouldRemove = await SignFieldImageRemoveConfirmationDialog.call({});
    if (shouldRemove) {
      return {
        type: field.type,
        value: null,
      };
    }
    return null;
  }

  const signatureToInsert = await SignFieldImageUploadDialog.call({
    initialImage: initialSignature,
  });

  if (!signatureToInsert) {
    return null;
  }

  return {
    type: field.type,
    value: signatureToInsert,
  };
};
