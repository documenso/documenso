import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { DigestAlgorithm, TimestampAuthority } from '@libpdf/core';

import { hashOidForDigest } from './algorithm-resolver';
import { cscTimestamp } from './client/signatures';
import type { CscTransport } from './transport';

/**
 * libpdf {@link TimestampAuthority} backed by the CSC TSP's
 * `signatures/timestamp` endpoint (§11.10).
 *
 * Used only at sign time, per recipient, when {@link resolveCscSignTimeTsa}
 * selects the TSP source — that is, when the TSP advertises
 * `signatures/timestamp` in `info.methods`. The token wired in is the
 * current recipient's own service-scope bearer (the same one authorising
 * the `signatures/signHash` call alongside it), so the timestamp gets
 * attributed to the same identity that just authorised the signature.
 *
 * Seal-time archival timestamps do not use this class — they go through
 * the env-only path in `finalize-tsp-completion.ts`.
 *
 * Failure semantics: a single `signatures/timestamp` call. On any error
 * (HTTP, schema, expired token) we surface `CSC_PROVIDER_NO_TSA` with the
 * upstream message folded in. There's no try-in-order — at sign time the
 * recipient is fixed, so there's no other token to fall through to.
 */

type CscTspTimestampAuthorityOptions = {
  transport: CscTransport;
  /** Decrypted service-scope access token for the current recipient. */
  serviceToken: string;
  /** Optional deadline for the `signatures/timestamp` call. */
  signal?: AbortSignal;
};

export class CscTspTimestampAuthority implements TimestampAuthority {
  private readonly transport: CscTransport;

  private readonly serviceToken: string;

  private readonly signal?: AbortSignal;

  constructor(opts: CscTspTimestampAuthorityOptions) {
    this.transport = opts.transport;
    this.serviceToken = opts.serviceToken;
    this.signal = opts.signal;
  }

  /**
   * Request a CSC §11.10 timestamp for the supplied digest, authorised with
   * the recipient's service-scope bearer. Returns the decoded TimeStampToken
   * bytes. Throws `CSC_PROVIDER_NO_TSA` carrying the upstream error message
   * on failure.
   *
   * `algorithm` is libpdf's `DigestAlgorithm` (`SHA-256` / `SHA-384` /
   * `SHA-512`), translated to the matching `hashAlgo` OID via the existing
   * {@link hashOidForDigest} mapping so the spec's OID-typed payload stays
   * in one place.
   */
  async timestamp(digest: Uint8Array, algorithm: DigestAlgorithm): Promise<Uint8Array> {
    const hash = Buffer.from(digest).toString('base64');
    const hashAlgo = hashOidForDigest(algorithm);

    try {
      const response = await cscTimestamp({
        baseUrl: this.transport.serviceBaseUrl,
        accessToken: this.serviceToken,
        hash,
        hashAlgo,
        signal: this.signal,
      });

      return Buffer.from(response.timestamp, 'base64');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      throw new AppError(AppErrorCode.CSC_PROVIDER_NO_TSA, {
        message: `CSC TSP timestamp endpoint refused the recipient's service token: ${message}.`,
      });
    }
  }
}
