import { env } from '@documenso/lib/utils/env';
import { signWithUsbToken as signWithUsbTokenNative } from '@documenso/pdf-sign';

import { addSigningPlaceholder } from '../helpers/add-signing-placeholder';
import { updateSigningPlaceholder } from '../helpers/update-signing-placeholder';

export type SignWithUsbTokenOptions = {
  pdf: Buffer;
};

export const signWithUsbToken = async ({ pdf }: SignWithUsbTokenOptions) => {
  const { pdf: pdfWithPlaceholder, byteRange } = updateSigningPlaceholder({
    pdf: await addSigningPlaceholder({ pdf }),
  });

  const pdfWithoutSignature = Buffer.concat([
    new Uint8Array(pdfWithPlaceholder.subarray(0, byteRange[1])),
    new Uint8Array(pdfWithPlaceholder.subarray(byteRange[2])),
  ]);

  const signatureLength = byteRange[2] - byteRange[1];

  const libraryPath = env('NEXT_PRIVATE_SIGNING_USB_TOKEN_LIBRARY_PATH');
  const slotId = parseInt(env('NEXT_PRIVATE_SIGNING_USB_TOKEN_SLOT_ID') || '0', 10);
  const pin = env('NEXT_PRIVATE_SIGNING_USB_TOKEN_PIN');
  const keyId = Buffer.from(env('NEXT_PRIVATE_SIGNING_USB_TOKEN_KEY_ID') || '', 'hex');

  if (!libraryPath) {
    throw new Error('USB token library path is required');
  }

  if (!pin) {
    throw new Error('USB token PIN is required');
  }

  if (keyId.length === 0) {
    throw new Error('USB token key ID is required');
  }

  const signature = signWithUsbTokenNative({
    cert: Buffer.from(''), // Certificate will be retrieved from the token
    content: pdfWithoutSignature,
    libraryPath,
    slotId,
    pin,
    keyId,
    timestampServer: env('NEXT_PRIVATE_SIGNING_TIMESTAMP_SERVER') || undefined,
  });

  const signatureAsHex = signature.toString('hex');

  const signedPdf = Buffer.concat([
    new Uint8Array(pdfWithPlaceholder.subarray(0, byteRange[1])),
    new Uint8Array(Buffer.from(`<${signatureAsHex.padEnd(signatureLength - 2, '0')}>`)),
    new Uint8Array(pdfWithPlaceholder.subarray(byteRange[2])),
  ]);

  return signedPdf;
};
