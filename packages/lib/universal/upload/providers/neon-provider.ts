import { env } from '@documenso/lib/utils/env';

import { S3Provider } from './s3-provider';

const NEON_STORAGE_ENDPOINT_REGEX = /\.storage\.c-\d+\.([a-z0-9-]+)\.aws\.neon\.tech$/;

/**
 * Derive the signing region from a Neon branch storage endpoint, for example
 * `https://br-cool-darkness-a1b2c3d4.storage.c-7.us-east-2.aws.neon.tech` -> `us-east-2`.
 *
 * Throws when the endpoint is not a valid URL, and returns `undefined` when it is
 * a valid URL that is not a Neon branch storage endpoint.
 */
export const getNeonStorageRegion = (endpoint: string): string | undefined => {
  let hostname: string;

  try {
    hostname = new URL(endpoint).hostname;
  } catch {
    throw new Error(
      `NEXT_PRIVATE_UPLOAD_ENDPOINT is not a valid URL: "${endpoint}". Expected a Neon branch storage endpoint such as https://br-xxx.storage.c-7.us-east-2.aws.neon.tech.`,
    );
  }

  return hostname.match(NEON_STORAGE_ENDPOINT_REGEX)?.[1];
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

    // Always parse the endpoint so a malformed URL fails here even when the region is overridden.
    const endpointRegion = getNeonStorageRegion(endpoint);

    // Neon verifies the signature but not the region in its credential scope, so the
    // `us-east-1` fallback for unrecognised endpoints still signs valid requests.

    super({
      endpoint,
      forcePathStyle: true,
      region: env('NEXT_PRIVATE_UPLOAD_REGION') || endpointRegion || 'us-east-1',
    });
  }
}
