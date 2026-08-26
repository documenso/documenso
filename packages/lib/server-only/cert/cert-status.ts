import { X509Certificate } from 'node:crypto';

import { getSigningTransport } from '@documenso/signing/helpers/transport';
import { createLocalSigner } from '@documenso/signing/transports/local';

/**
 * Whether the local P12 opens with the configured passphrase and is in date.
 * Skips AIA so this stays offline. gcloud-hsm and csc always report available.
 */
export const getCertificateStatus = async () => {
  const transport = getSigningTransport();

  // Cannot inspect a remote HSM or CSC provider from this process.
  if (transport === 'gcloud-hsm' || transport === 'csc') {
    return { isAvailable: true };
  }

  // Anything else (typo, leftover `http`) would throw at seal time.
  if (transport !== 'local') {
    return { isAvailable: false };
  }

  try {
    const signer = await createLocalSigner({ buildChain: false });

    const certificate = new X509Certificate(Buffer.from(signer.certificate));

    const now = new Date();

    const isWithinValidityPeriod = new Date(certificate.validFrom) <= now && now <= new Date(certificate.validTo);

    return { isAvailable: isWithinValidityPeriod };
  } catch {
    return { isAvailable: false };
  }
};
