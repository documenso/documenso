/**
 * verify-document.ts
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

import { extractSignature } from '@documenso/lib/server-only/verify/extract-signature';
import {
  assertFileSize,
  assertIsPDF,
  zeroBuf,
} from '@documenso/lib/server-only/verify/verify-utils';

import { procedure } from '../trpc';
import {
  ZVerifyDocumentRequestSchema,
  ZVerifyDocumentResponseSchema,
} from './verify-document.types';

// Note: This is an unauthenticated public route — intentionally no auth middleware.
export const verifyDocumentRoute = procedure
  .input(ZVerifyDocumentRequestSchema)
  .output(ZVerifyDocumentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const {
      fileBytes,
      fileName: _fileName, // used only for display — never for logic
    } = input;

    ctx.logger.info({
      input: {
        fileSize: fileBytes.byteLength,
      },
    });

    // Convert Uint8Array to Buffer for Node.js crypto/parsing APIs
    const buf = Buffer.from(fileBytes);

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
      // extractSignature() is ready. Until then, uses the stub.
      const result = await extractSignature(buf);

      return result;
    } finally {
      // ── Step 4: Memory zeroing ────────────────────────────
      // PRD: "buf.fill(0) inside a try/finally block before garbage
      // collection. Not just 'cleared' — actively zeroed."
      // This MUST stay in finally — it fires on both success and error.
      zeroBuf(buf);
    }
  });
