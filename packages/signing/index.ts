import {
  NEXT_PRIVATE_SIGNING_TRANSPORT,
  NEXT_PRIVATE_USE_LEGACY_SIGNING_SUBFILTER,
  NEXT_PUBLIC_SIGNING_CONTACT_INFO,
  NEXT_PUBLIC_WEBAPP_URL,
} from '@documenso/lib/constants/app';
import type { PDF, Signer } from '@libpdf/core';
import { match } from 'ts-pattern';

import { getTimestampAuthority } from './helpers/tsa';
import { createGoogleCloudSigner } from './transports/google-cloud';
import { createLocalSigner } from './transports/local';

export type SignOptions = {
  pdf: PDF;
};

let signer: Signer | null = null;

const getSigner = async () => {
  if (signer) {
    return signer;
  }

  const transport = NEXT_PRIVATE_SIGNING_TRANSPORT();

  // eslint-disable-next-line require-atomic-updates
  signer = await match(transport)
    .with('local', async () => await createLocalSigner())
    .with('gcloud-hsm', async () => await createGoogleCloudSigner())
    .otherwise(() => {
      throw new Error(`Unsupported signing transport: ${transport}`);
    });

  return signer;
};

export const signPdf = async ({ pdf }: SignOptions) => {
  const signer = await getSigner();

  const tsa = getTimestampAuthority();

  const { bytes } = await pdf.sign({
    signer,
    reason: 'Signed by Documenso',
    location: NEXT_PUBLIC_WEBAPP_URL(),
    contactInfo: NEXT_PUBLIC_SIGNING_CONTACT_INFO(),
    subFilter: NEXT_PRIVATE_USE_LEGACY_SIGNING_SUBFILTER() ? 'adbe.pkcs7.detached' : 'ETSI.CAdES.detached',
    timestampAuthority: tsa ?? undefined,
    longTermValidation: !!tsa,
    archivalTimestamp: !!tsa,
    // A B-LTA signature (signer chain + RFC 3161 timestamp token + LTV
    // revocation data) can exceed the 12288-byte default placeholder,
    // depending on the signing certificate chain and the TSA responder.
    // The unused portion is zero-padding, so over-reserving is cheap.
    estimatedSize: tsa ? 32768 : undefined,
  });

  return bytes;
};
