import { env } from '@documenso/lib/utils/env';

import { S3Provider } from './s3-provider';

const NEON_STORAGE_ENDPOINT_REGEX = /\.storage\.c-\d+\.([a-z0-9-]+)\.aws\.neon\.tech$/;

/**
 * Derive the signing region from a Neon branch storage endpoint, for example
 * `https://br-cool-darkness-a1b2c3d4.storage.c-7.us-east-2.aws.neon.tech` -> `us-east-2`.
 */
export const getNeonStorageRegion = (endpoint: string): string | undefined => {
  try {
    return new URL(endpoint).hostname.match(NEON_STORAGE_ENDPOINT_REGEX)?.[1];
  } catch {
    return undefined;
  }
};

/**
 * Neon Object Storage speaks the S3 API on a per-branch endpoint. It only
 * supports path-style addressing, so this provider forces it and signs with the
 * region encoded in the endpoint unless `NEXT_PRIVATE_UPLOAD_REGION` is set.
 */
export class NeonProvider extends S3Provider {
  constructor() {
    const endpoint = env('NEXT_PRIVATE_UPLOAD_ENDPOINT');

    if (!endpoint) {
      throw new Error(
        'NEXT_PRIVATE_UPLOAD_ENDPOINT must be set to your Neon branch storage endpoint when using the "neon" transport.',
      );
    }

    super({
      endpoint,
      forcePathStyle: true,
      region: env('NEXT_PRIVATE_UPLOAD_REGION') || getNeonStorageRegion(endpoint) || 'us-east-1',
    });
  }
}
