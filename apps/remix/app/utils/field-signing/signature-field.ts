import { FieldType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldSignature } from '@documenso/lib/types/field';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';

import { SignFieldSignatureDialog } from '~/components/dialogs/sign-field-signature-dialog';

type HandleSignatureFieldClickOptions = {
  field: TFieldSignature;
  fullName?: string;
  signature: string | null;
  typedSignatureEnabled?: boolean;
  uploadSignatureEnabled?: boolean;
  drawSignatureEnabled?: boolean;
};

export const handleSignatureFieldClick = async (
  options: HandleSignatureFieldClickOptions,
): Promise<Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.SIGNATURE }> | null> => {
  const {
    field,
    fullName,
    signature,
    typedSignatureEnabled,
    uploadSignatureEnabled,
    drawSignatureEnabled,
  } = options;

  if (field.type !== FieldType.SIGNATURE) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid field type',
    });
  }

  if (field.inserted) {
    return {
      type: FieldType.SIGNATURE,
      value: null,
    };
  }

  let signatureToInsert = signature;

  if (!signatureToInsert) {
    signatureToInsert = await SignFieldSignatureDialog.call({
      fullName,
      typedSignatureEnabled,
      uploadSignatureEnabled,
      drawSignatureEnabled,
    });
  }

  if (!signatureToInsert) {
    return null;
  }

  return {
    type: FieldType.SIGNATURE,
    value: signatureToInsert,
  };
};
