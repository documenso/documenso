import type { TVerifyResult } from '@documenso/trpc/server/document-router/verify-document.types';

// ─────────────────────────────────────────────────────────────
// STUB: extractSignature
// Placeholder until Gamaliel delivers the Cryptographic Spec (D1)
// and the D2 spike concludes. Replace with Gamaliel's implementation.
// Joel connects the procedure to the real function on D4.
//
// Interface Gamaliel must conform to:
//   async function extractSignature(buf: Buffer): Promise<TVerifyResult>
//   Must return one of: VERIFIED | TRUSTED | UNKNOWN | INVALID | REVOKED
//   signers: initials-only (J.G.) + masked email (j***@domain.com)
//   timestamp: TSA-validated signing date + validation status
//   cert: issuer, serial, validity dates, trustedBundle boolean
//   requiredDisclaimers: which of the 3 PRD texts Gary must display
// ─────────────────────────────────────────────────────────────

// TODO (D4): Replace body with Gamaliel's real extractSignature() import.
// The stub returns UNKNOWN to make all result state UI testable
// before the crypto implementation is complete.
// eslint-disable-next-line @typescript-eslint/require-await
export const extractSignature = async (_buf: Buffer): Promise<TVerifyResult> => {
  return {
    state: 'UNKNOWN',
    signers: [{ initials: 'J.G.', maskedEmail: 'j***@example.com' }],
    timestamp: { signingDate: new Date().toISOString(), tsaValidated: false },
    cert: {
      issuer: 'Stub CA',
      serialNumber: '00:00:00:00',
      validFrom: new Date().toISOString(),
      validTo: new Date().toISOString(),
      trustedBundle: false,
      revocationStatus: 'UNKNOWN',
    },
    requiredDisclaimers: ['GENERAL', 'UNKNOWN_ISSUER'],
  };
};
