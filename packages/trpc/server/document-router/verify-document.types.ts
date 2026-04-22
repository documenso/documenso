import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// RESULT STATE TYPES
// Five states per roadmap Section 3.2 and Section 7.
// All states must communicate via color + icon + text (never color alone).
// ─────────────────────────────────────────────────────────────

export const ZVerifyResultStateSchema = z.enum([
  'VERIFIED', // Green  — Documenso-signed, valid cert, valid OCSP/CRL
  'TRUSTED', //  Amber  — Valid cert in AATL/Mozilla bundle, not Documenso
  'UNKNOWN', //  Amber  — Cert not in trusted bundle (Disclaimer 2 required)
  'INVALID', //  Red    — Tampered or corrupt signature structure
  'REVOKED', //  Red    — Valid structure but cert revoked (Disclaimer 3 if OCSP+CRL fail)
]);

export type TVerifyResultState = z.infer<typeof ZVerifyResultStateSchema>;

export const ZSignerInfoSchema = z.object({
  /** Initials only — e.g. "J.G." — never a full name or surname fragment */
  initials: z.string(),
  /** Masked email — e.g. "j***@domain.com" — never the full address */
  maskedEmail: z.string(),
});

export type TSignerInfo = z.infer<typeof ZSignerInfoSchema>;

export const ZTimestampInfoSchema = z.object({
  /** ISO 8601 signing timestamp extracted from TSA */
  signingDate: z.string().nullable(),
  /** Whether the TSA timestamp was validated against a trusted TSA */
  tsaValidated: z.boolean(),
});

export type TTimestampInfo = z.infer<typeof ZTimestampInfoSchema>;

export const ZCertInfoSchema = z.object({
  issuer: z.string(),
  serialNumber: z.string(),
  validFrom: z.string(),
  validTo: z.string(),
  /** Whether the cert chains to the hardcoded AATL + Mozilla bundle */
  trustedBundle: z.boolean(),
  /** OCSP/CRL revocation check result */
  revocationStatus: z.enum(['VALID', 'REVOKED', 'UNKNOWN', 'CHECK_FAILED']),
});

export type TCertInfo = z.infer<typeof ZCertInfoSchema>;

export const ZVerifyResultSchema = z.object({
  state: ZVerifyResultStateSchema,
  signers: z.array(ZSignerInfoSchema),
  timestamp: ZTimestampInfoSchema,
  cert: ZCertInfoSchema.nullable(),
  /**
   * Which legal disclaimer(s) must be displayed.
   * Gary injects these verbatim from roadmap Section 5.
   * Joel never modifies disclaimer text — Paula owns that.
   */
  requiredDisclaimers: z.array(z.enum(['GENERAL', 'UNKNOWN_ISSUER', 'REVOCATION_FAILURE'])),
});

export type TVerifyResult = z.infer<typeof ZVerifyResultSchema>;

// ─────────────────────────────────────────────────────────────
// REQUEST / RESPONSE SCHEMAS
// ─────────────────────────────────────────────────────────────

export const ZVerifyDocumentRequestSchema = z.object({
  /** Raw file bytes from the multipart form upload */
  fileBytes: z.instanceof(Uint8Array),
  /** Original filename — used only for display, never for logic */
  fileName: z.string().max(255).optional(),
});

export const ZVerifyDocumentResponseSchema = ZVerifyResultSchema;

export type TVerifyDocumentRequest = z.infer<typeof ZVerifyDocumentRequestSchema>;
export type TVerifyDocumentResponse = z.infer<typeof ZVerifyDocumentResponseSchema>;
