import { match } from 'ts-pattern';

import { env } from '@documenso/lib/utils/env';

import { signWithGoogleCloudHSM } from './transports/google-cloud-hsm';
import { signWithLocalCert } from './transports/local-cert';
import { signWithTrustedSignatures } from './transports/trusted-signatures';

export type SignOptions = {
  pdf: Buffer;
};

export const signPdf = async ({ pdf }: SignOptions) => {
  const transport = env('NEXT_PRIVATE_SIGNING_TRANSPORT') || 'local';

  return await match(transport)
    .with('local', async () => signWithLocalCert({ pdf }))
    .with('gcloud-hsm', async () => signWithGoogleCloudHSM({ pdf }))
    .with('trusted-signatures', async () => signWithTrustedSignatures({ pdf }))
    .otherwise(() => {
      throw new Error(`Unsupported signing transport: ${transport}`);
    });
};
