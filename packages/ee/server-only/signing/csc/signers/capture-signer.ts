/**
 * CSC dry-run capture signer.
 *
 * Libpdf's signing flow expects an inline signer that hashes the
 * `signedAttrs` bytes and returns a CMS signature. For the CSC §11.9
 * `signatures/signHash` contract the actual signature is produced
 * remotely by the TSP, so a single libpdf sign cycle has to be split
 * into two passes:
 *
 * 1. Dry-run — drive `pdf.sign()` with this capture signer to derive
 *    the `signedAttrs` digest libpdf would otherwise sign. The
 *    resulting PDF is discarded; only `capturedDigest` matters.
 * 2. Embed pass — the `CscFifoSigner` re-runs `pdf.sign()` and feeds
 *    the TSP-produced signature bytes back into the same byte slots.
 *
 * The placeholder bytes returned from `sign()` are sized to the
 * chosen algorithm so libpdf's downstream CMS construction is not
 * surprised by an unexpectedly short signature.
 */

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { Signer } from '@libpdf/core';
import { sha256, sha384, sha512 } from '@noble/hashes/sha2';

import type { LibpdfSignerAlgo } from '../algorithm-resolver';

type DigestAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512';

type KeyType = 'RSA' | 'EC';

type SignatureAlgorithm = 'RSASSA-PKCS1-v1_5' | 'RSA-PSS' | 'ECDSA';

export type CscCaptureSignerOptions = {
  certificate: Uint8Array;
  certificateChain?: Uint8Array[];
  algo: LibpdfSignerAlgo;
};

export class CscCaptureSigner implements Signer {
  readonly certificate: Uint8Array;
  readonly certificateChain?: Uint8Array[];
  readonly keyType: KeyType;
  readonly signatureAlgorithm: SignatureAlgorithm;
  private readonly algo: LibpdfSignerAlgo;

  /** Populated by `sign()`. `null` until libpdf calls into the signer. */
  capturedDigest: Uint8Array | null = null;

  constructor(options: CscCaptureSignerOptions) {
    this.certificate = options.certificate;
    this.certificateChain = options.certificateChain;
    this.keyType = options.algo.keyType;
    this.signatureAlgorithm = options.algo.signatureAlgorithm;
    this.algo = options.algo;
  }

  /**
   * Hash `data` with `algorithm` to derive the `signedAttrs` digest libpdf
   * would normally sign, stash it on `capturedDigest`, then return a
   * placeholder buffer sized to the chosen key so libpdf's CMS scaffolding
   * accepts it. The placeholder bytes are never inspected — the resulting
   * PDF is discarded after the digest is read.
   */

  // biome-ignore lint/suspicious/useAwait: intentional
  async sign(data: Uint8Array, algorithm: DigestAlgorithm): Promise<Uint8Array> {
    if (this.capturedDigest !== null) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'CscCaptureSigner.sign() called more than once — capture signers are single-use.',
      });
    }

    this.capturedDigest = hashData(data, algorithm);

    return new Uint8Array(placeholderSize(this.algo));
  }
}

const hashData = (data: Uint8Array, algorithm: DigestAlgorithm): Uint8Array => {
  if (algorithm === 'SHA-256') {
    return sha256(data);
  }

  if (algorithm === 'SHA-384') {
    return sha384(data);
  }

  if (algorithm === 'SHA-512') {
    return sha512(data);
  }

  throw new AppError(AppErrorCode.INVALID_REQUEST, {
    message: `CscCaptureSigner.sign() called with unsupported digest algorithm '${String(algorithm)}'.`,
  });
};

const placeholderSize = (algo: LibpdfSignerAlgo): number => {
  if (algo.keyType === 'RSA') {
    // RSA signature length === modulus length in bytes.
    if (algo.keyLenBits >= 4096) {
      return 512;
    }

    if (algo.keyLenBits >= 3072) {
      return 384;
    }

    return 256;
  }

  // ECDSA DER-encoded SEQUENCE { INTEGER r, INTEGER s }. Upper bounds:
  // P-256 ≈ 72 bytes, P-384 ≈ 104, P-521 ≈ 139. The dry-run PDF is
  // discarded — exact size is informational, not load-bearing.
  if (algo.keyLenBits >= 512) {
    return 139;
  }

  if (algo.keyLenBits >= 384) {
    return 104;
  }

  return 72;
};
