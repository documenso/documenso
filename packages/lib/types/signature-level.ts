import { z } from 'zod';

/**
 * The cryptographic signature tier an envelope is signed at.
 *
 * - `SES` — Simple Electronic Signature; the default Documenso flow signed
 *   with the instance-held certificate.
 * - `AES` — Advanced Electronic Signature; recipient-bound signing through a
 *   Cloud Signature Consortium (CSC) Trust Service Provider.
 * - `QES` — Qualified Electronic Signature; the eIDAS-qualified variant of
 *   AES, also recipient-bound through a CSC TSP.
 *
 * Stored as free-form TEXT on `Envelope.signatureLevel` so the legal-tier
 * taxonomy can expand without a DB enum migration. Validation lives here.
 */
export const ZSignatureLevelSchema = z.enum(['SES', 'AES', 'QES']);

export const SignatureLevel = ZSignatureLevelSchema.enum;

export type TSignatureLevel = z.infer<typeof ZSignatureLevelSchema>;

/**
 * Whether an envelope's signature level routes through a Cloud Signature
 * Consortium Trust Service Provider (`AES` or `QES`). The single branch point
 * for TSP-vs-SES runtime divergence — seal handler, download endpoint,
 * completion email, and send-time PDF prep all key off this.
 *
 * Accepts a raw `string` because the Prisma column is TEXT; unknown values
 * are conservatively treated as non-TSP so a malformed row can't accidentally
 * trigger TSP-only code paths.
 */
export const isTspEnvelope = (envelope: { signatureLevel: string }): boolean =>
  envelope.signatureLevel === SignatureLevel.AES || envelope.signatureLevel === SignatureLevel.QES;
