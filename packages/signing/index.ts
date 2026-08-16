import {
  NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY,
  NEXT_PRIVATE_USE_LEGACY_SIGNING_SUBFILTER,
  NEXT_PUBLIC_SIGNING_CONTACT_INFO,
  NEXT_PUBLIC_WEBAPP_URL,
} from '@documenso/lib/constants/app';
import { env } from '@documenso/lib/utils/env';
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

  const transport = env('NEXT_PRIVATE_SIGNING_TRANSPORT') || 'local';

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
  const hasTsa = !!tsa;

  try {
    const { bytes } = await pdf.sign({
      signer,
      reason: 'Signed by Documenso',
      location: NEXT_PUBLIC_WEBAPP_URL(),
      contactInfo: NEXT_PUBLIC_SIGNING_CONTACT_INFO(),
      subFilter: NEXT_PRIVATE_USE_LEGACY_SIGNING_SUBFILTER() ? 'adbe.pkcs7.detached' : 'ETSI.CAdES.detached',
      timestampAuthority: tsa ?? undefined,
      longTermValidation: hasTsa,
      archivalTimestamp: hasTsa,
    });

    return bytes;
  } catch (error) {
    if (hasTsa) {
      console.error('[TSA-ERROR] PDF signing failed during timestamping', {
        timestampAuthorities: NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY() ?? null,
        message: error instanceof Error ? error.message : String(error),
        cause: error instanceof Error && error.cause ? String(error.cause) : undefined,
        error,
      });
    }

    throw error;
  }
};
