/**
 * CSC embed-pass FIFO signer.
 *
 * `signatures/signHash` (CSC §11.9) returns one signature per submitted
 * hash, in the same position-bound order as the request `hash[]` array.
 * The embed pass re-runs `pdf.sign()` once per anchor in that same order,
 * so a FIFO queue of signature bytes — popped on each `sign()` call —
 * is sufficient to feed libpdf without any per-anchor binding metadata.
 */

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { Signer } from '@libpdf/core';

import type { LibpdfSignerAlgo } from '../algorithm-resolver';

type DigestAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512';

type KeyType = 'RSA' | 'EC';

type SignatureAlgorithm = 'RSASSA-PKCS1-v1_5' | 'RSA-PSS' | 'ECDSA';

export type CscFifoSignerOptions = {
  certificate: Uint8Array;
  certificateChain?: Uint8Array[];
  algo: LibpdfSignerAlgo;
  /** Base64-decoded raw signature bytes in the order produced by `signatures/signHash`. */
  signatures: Uint8Array[];
};

export class CscFifoSigner implements Signer {
  readonly certificate: Uint8Array;
  readonly certificateChain?: Uint8Array[];
  readonly keyType: KeyType;
  readonly signatureAlgorithm: SignatureAlgorithm;
  private readonly queue: Uint8Array[];

  constructor(options: CscFifoSignerOptions) {
    this.certificate = options.certificate;
    this.certificateChain = options.certificateChain;
    this.keyType = options.algo.keyType;
    this.signatureAlgorithm = options.algo.signatureAlgorithm;
    this.queue = [...options.signatures];
  }

  // biome-ignore lint/suspicious/useAwait: intentional
  async sign(_data: Uint8Array, _algorithm: DigestAlgorithm): Promise<Uint8Array> {
    const next = this.queue.shift();

    if (next === undefined) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'CSC FIFO signer exhausted — more sign() calls than queued signatures.',
      });
    }

    return next;
  }
}
