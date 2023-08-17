'use server';

import { DateTime } from 'luxon';

import { prisma } from '@documenso/prisma';
import { DocumentStatus, FieldType, SigningStatus } from '@documenso/prisma/client';

export type SignFieldWithTokenOptions = {
  token: string;
  fieldId: number;
  value: string;
  isBase64?: boolean;
};

export const signFieldWithToken = async ({
  token,
  fieldId,
  value,
  isBase64,
}: SignFieldWithTokenOptions) => {
  const field = await prisma.field.findFirstOrThrow({
    where: {
      id: fieldId,
      Recipient: {
        token,
      },
    },
    include: {
      Document: true,
      Recipient: true,
    },
  });

  const { Document: document, Recipient: recipient } = field;

  if (document.status === DocumentStatus.COMPLETED) {
    throw new Error(`Document ${document.id} has already been completed`);
  }

  if (recipient?.signingStatus === SigningStatus.SIGNED) {
    throw new Error(`Recipient ${recipient.id} has already signed`);
  }

  if (field.inserted) {
    throw new Error(`Field ${fieldId} has already been inserted`);
  }

  // Unreachable code based on the above query but we need to satisfy TypeScript
  if (field.recipientId === null) {
    throw new Error(`Field ${fieldId} has no recipientId`);
  }

  const isSignatureField =
    field.type === FieldType.SIGNATURE || field.type === FieldType.FREE_SIGNATURE;

  let customText = !isSignatureField ? value : undefined;
  const signatureImageAsBase64 = isSignatureField && isBase64 ? value : undefined;
  const typedSignature = isSignatureField && !isBase64 ? value : undefined;

  if (field.type === FieldType.DATE) {
    customText = DateTime.now().toFormat('yyyy-MM-dd hh:mm a');
  }

  await prisma.field.update({
    where: {
      id: field.id,
    },
    data: {
      customText,
      inserted: true,
      Signature: isSignatureField
        ? {
            upsert: {
              create: {
                recipientId: field.recipientId,
                signatureImageAsBase64,
                typedSignature,
              },
              update: {
                recipientId: field.recipientId,
                signatureImageAsBase64,
                typedSignature,
              },
            },
          }
        : undefined,
    },
  });
};
