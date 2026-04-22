/**
 * verify.procedure.ts
 * Documenso — Verification Portal (#1764)
 * Owner: Joel (route/procedure scaffold) + Gamaliel (extraction logic)
 * Roadmap ref: D3 Joel — "tRPC procedure document.verify: multipart upload,
 *              magic bytes check, MAX_FILE_SIZE rejection, buf.fill(0)"
 *              D4 Joel + Gamaliel — "Connect tRPC procedure to extraction function"
 *
 * This file defines the tRPC procedure Joel owns.
 * Gamaliel's extractSignature() function slots into the marked section.
 * The try/finally contract must not be changed — it is a PRD requirement.
 */

import { z } from "zod";
import { publicProcedure } from "../trpc"; // Adjust import path to match Documenso's tRPC setup
import {
  assertIsPDF,
  assertFileSize,
  zeroBuf,
  VerifyInputError,
  type VerifyErrorCode,
} from "../utils/verify-utils";

// ─────────────────────────────────────────────────────────────
// RESULT STATE TYPES
// Five states per roadmap Section 3.2 and Section 7.
// All states must communicate via color + icon + text (never color alone).
// ─────────────────────────────────────────────────────────────

export type VerifyResultState =
  | "VERIFIED"    // Green  — Documenso-signed, valid cert, valid OCSP/CRL
  | "TRUSTED"     // Amber  — Valid cert in AATL/Mozilla bundle, not Documenso
  | "UNKNOWN"     // Amber  — Cert not in trusted bundle (Disclaimer 2 required)
  | "INVALID"     // Red    — Tampered or corrupt signature structure
  | "REVOKED";    // Red    — Valid structure but cert revoked (Disclaimer 3 if OCSP+CRL fail)

export interface SignerInfo {
  /** Initials only — e.g. "J.G." — never a full name or surname fragment */
  initials: string;
  /** Masked email — e.g. "j***@domain.com" — never the full address */
  maskedEmail: string;
}

export interface TimestampInfo {
  /** ISO 8601 signing timestamp extracted from TSA */
  signingDate: string | null;
  /** Whether the TSA timestamp was validated against a trusted TSA */
  tsaValidated: boolean;
}

export interface CertInfo {
  issuer: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  /** Whether the cert chains to the hardcoded AATL + Mozilla bundle */
  trustedBundle: boolean;
  /** OCSP/CRL revocation check result */
  revocationStatus: "VALID" | "REVOKED" | "UNKNOWN" | "CHECK_FAILED";
}

export interface VerifyResult {
  state: VerifyResultState;
  signers: SignerInfo[];
  timestamp: TimestampInfo;
  cert: CertInfo | null;
  /**
   * Which legal disclaimer(s) must be displayed.
   * Gary injects these verbatim from roadmap Section 5.
   * Joel never modifies disclaimer text — Paula owns that.
   */
  requiredDisclaimers: Array<"GENERAL" | "UNKNOWN_ISSUER" | "REVOCATION_FAILURE">;
}

// ─────────────────────────────────────────────────────────────
// INPUT SCHEMA
// Zod schema for the multipart upload.
// The buffer arrives as a Uint8Array from the multipart form parser.
// ─────────────────────────────────────────────────────────────

const verifyInputSchema = z.object({
  /** Raw file bytes from the multipart form upload */
  fileBytes: z.instanceof(Uint8Array),
  /** Original filename — used only for display, never for logic */
  fileName: z.string().max(255).optional(),
});

// ─────────────────────────────────────────────────────────────
// PROCEDURE
// Public procedure — no authentication middleware.
// The /verify route is intentionally unauthenticated (guest mode).
// ─────────────────────────────────────────────────────────────

export const verifyDocumentProcedure = publicProcedure
  .input(verifyInputSchema)
  .mutation(async ({ input }): Promise<VerifyResult> => {
    // Convert Uint8Array to Buffer for Node.js crypto/parsing APIs
    const buf = Buffer.from(input.fileBytes);

    try {
      // ── Step 1: Magic bytes check ─────────────────────────
      // MUST run before any parsing library is invoked.
      // PRD: "Magic bytes (%PDF- prefix) BEFORE any parsing library"
      assertIsPDF(buf);

      // ── Step 2: File size check ───────────────────────────
      // Reuses MAX_FILE_SIZE env variable. No new limit introduced.
      assertFileSize(buf);

      // ── Step 3: Signature extraction ─────────────────────
      // Gamaliel owns this function. It handles:
      //   - AATL + Mozilla CA bundle validation
      //   - OCSP primary check + CRL fallback
      //   - TSA timestamp extraction and validation
      //   - Initials-only PII masking (J.G. format)
      //   - Result state determination
      //
      // D4 milestone: Joel wires this call once Gamaliel's
      // extractSignature() is ready. Until then, use the stub below.
      const result = await extractSignature(buf);

      return result;

    } catch (err) {
      if (err instanceof VerifyInputError) {
        // Rethrow typed errors — the route handler maps these to
        // user-facing messages. Never expose raw error messages.
        throw err;
      }

      // For unexpected errors, return INVALID state rather than
      // throwing a 500 — we never want to expose stack traces
      // on a public unauthenticated endpoint.
      console.error("[verify] Unhandled extraction error:", {
        code: (err as Error).name,
        // Never log the buffer content or file name
      });

      return {
        state: "INVALID",
        signers: [],
        timestamp: { signingDate: null, tsaValidated: false },
        cert: null,
        requiredDisclaimers: ["GENERAL"],
      };

    } finally {
      // ── Step 4: Memory zeroing ────────────────────────────
      // PRD: "buf.fill(0) inside a try/finally block before garbage
      // collection. Not just 'cleared' — actively zeroed."
      // This MUST stay in finally — it fires on both success and error.
      zeroBuf(buf);
    }
  });

// ─────────────────────────────────────────────────────────────
// STUB: extractSignature
// Placeholder until Gamaliel delivers the Cryptographic Spec (D1)
// and the D2 spike concludes. Replace with Gamaliel's implementation.
// Joel connects the procedure to the real function on D4.
// ─────────────────────────────────────────────────────────────

async function extractSignature(_buf: Buffer): Promise<VerifyResult> {
  // TODO (D4): Replace with Gamaliel's extractSignature() import
  // The stub returns UNKNOWN to make all result state UI testable
  // before the crypto implementation is complete.
  return {
    state: "UNKNOWN",
    signers: [{ initials: "J.G.", maskedEmail: "j***@example.com" }],
    timestamp: { signingDate: new Date().toISOString(), tsaValidated: false },
    cert: {
      issuer: "Stub CA",
      serialNumber: "00:00:00:00",
      validFrom: new Date().toISOString(),
      validTo: new Date().toISOString(),
      trustedBundle: false,
      revocationStatus: "UNKNOWN",
    },
    requiredDisclaimers: ["GENERAL", "UNKNOWN_ISSUER"],
  };
}

// ─────────────────────────────────────────────────────────────
// HELPER: mapErrorToUserMessage
// Maps typed VerifyInputError codes to safe user-facing strings.
// These strings are safe to display — they contain no technical details.
// Gary reviews these for tone/copy consistency with the result state pages.
// ─────────────────────────────────────────────────────────────

export function mapErrorToUserMessage(code: VerifyErrorCode): string {
  const messages: Record<VerifyErrorCode, string> = {
    INVALID_FILE_TYPE: "Please upload a PDF file.",
    FILE_TOO_LARGE:    "This file is too large. Please upload a file under 10MB.",
    RATE_LIMITED:      "Too many requests. Please wait before trying again.",
    PARSE_FAILED:      "This file could not be read. It may be corrupted or password-protected.",
    NO_SIGNATURE_FOUND: "No digital signature was found in this document.",
  };
  return messages[code];
}
