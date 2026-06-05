import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldImageUpload } from '@documenso/lib/types/field';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { FieldType } from '@prisma/client';

import { SignFieldImageUploadDialog } from '~/components/dialogs/sign-field-image-upload-dialog';

type HandleImageUploadFieldClickOptions = {
  field: TFieldImageUpload & {
    signature?: {
      signatureImageAsBase64?: string | null;
    } | null;
  };
  initialImage?: string | null;
};

export const handleImageUploadFieldClick = async (
  options: HandleImageUploadFieldClickOptions,
): Promise<Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.IMAGE_UPLOAD }> | null> => {
  const { field, initialImage } = options;

  if (field.type !== FieldType.IMAGE_UPLOAD) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid field type',
    });
  }

  if (field.inserted) {
    return {
      type: FieldType.IMAGE_UPLOAD,
      value: null,
    };
  }

  const image = await SignFieldImageUploadDialog.call({
    initialImage: initialImage ?? field.signature?.signatureImageAsBase64 ?? undefined,
  });

  if (!image) {
    return null;
  }

  return {
    type: FieldType.IMAGE_UPLOAD,
    value: image,
  };
};
