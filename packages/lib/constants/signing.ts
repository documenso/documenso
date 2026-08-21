import { env } from '@documenso/lib/utils/env';

/**
 * Default certificate path used by the local signing transport when
 * NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH is not set.
 *
 * Shared by the local signer (packages/signing/transports/local.ts) and the
 * certificate status check (packages/lib/server-only/cert/cert-status.ts) so
 * both resolve the same default. Before this was shared, the status check
 * reported /opt/documenso/cert.p12 as the production default while the signer
 * refused to run without an explicit path — a healthy status with every seal
 * failing (#2773).
 */
export const getLocalSigningCertificateDefaultPath = (): string =>
  env('NODE_ENV') === 'production' ? '/opt/documenso/cert.p12' : './example/cert.p12';
