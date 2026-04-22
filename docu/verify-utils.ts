/**
 * verify-utils.ts
 * Documenso — Verification Portal (#1764)
 * Owner: Joel (Ops / Project Lead)
 * Roadmap ref: D1 technical spec, D3 implementation, D7 security hardening
 *
 * All utility functions required by the /verify route.
 * Every function here maps directly to a PRD security requirement.
 */

import { createHash } from "crypto";

// ─────────────────────────────────────────────────────────────
// 1. MAGIC BYTES VALIDATION
// PRD requirement: Check %PDF- prefix BEFORE any parsing library
// is invoked. MIME type check alone is insufficient.
// Roadmap ref: D3 Joel — "magic bytes check (%PDF- prefix)"
// ─────────────────────────────────────────────────────────────

const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-

/**
 * Validates that a buffer begins with the PDF magic bytes (%PDF-).
 * Must be called before passing the buffer to any parsing library.
 * Returns false for empty buffers, non-PDF files, and truncated uploads.
 */
export function isPDF(buf: Buffer): boolean {
  if (buf.length < PDF_MAGIC.length) return false;
  return buf.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC);
}

/**
 * Throws a typed error if the buffer is not a valid PDF.
 * Use this at the entry point of the tRPC procedure before any
 * call to libpdf/core or node-forge.
 */
export function assertIsPDF(buf: Buffer): void {
  if (!isPDF(buf)) {
    throw new VerifyInputError(
      "INVALID_FILE_TYPE",
      "The uploaded file is not a PDF. Only PDF files can be verified."
    );
  }
}

// ─────────────────────────────────────────────────────────────
// 2. FILE SIZE VALIDATION
// PRD requirement: Reuse MAX_FILE_SIZE env variable.
// Do not introduce a new limit — inherit the one that exists.
// Roadmap ref: D3 Joel — "MAX_FILE_SIZE rejection"
// Default: 10MB per roadmap Section 3.2
// ─────────────────────────────────────────────────────────────

const MAX_FILE_BYTES =
  parseInt(process.env.MAX_FILE_SIZE ?? "10485760", 10); // 10MB default

/**
 * Validates the uploaded file size against the application-wide
 * MAX_FILE_SIZE env variable. Throws before any parsing occurs.
 */
export function assertFileSize(buf: Buffer): void {
  if (buf.length > MAX_FILE_BYTES) {
    const maxMB = (MAX_FILE_BYTES / 1024 / 1024).toFixed(0);
    throw new VerifyInputError(
      "FILE_TOO_LARGE",
      `File exceeds the maximum allowed size of ${maxMB}MB.`
    );
  }
}

// ─────────────────────────────────────────────────────────────
// 3. MEMORY ZEROING
// PRD requirement: buf.fill(0) inside a try/finally block before
// garbage collection. Actively zeroed — not just 'cleared'.
// Roadmap ref: D3 Joel — "Implement buf.fill(0) in try/finally"
//              D7 Joel — "Confirm buf.fill(0) fires via profiler"
// ─────────────────────────────────────────────────────────────

/**
 * Actively zeros a buffer in place.
 * MUST be called inside a try/finally block so it fires even
 * when the verification throws. The finally block is non-negotiable
 * per the PRD — a try/catch alone is insufficient.
 *
 * Usage pattern (enforced in verify.procedure.ts):
 *
 *   const buf = Buffer.from(uploadedBytes);
 *   try {
 *     assertIsPDF(buf);
 *     assertFileSize(buf);
 *     const result = await extractSignature(buf);
 *     return result;
 *   } finally {
 *     zeroBuf(buf); // Always fires — success or error
 *   }
 */
export function zeroBuf(buf: Buffer): void {
  buf.fill(0);
}

// ─────────────────────────────────────────────────────────────
// 4. IP ADDRESS HASHING
// PRD requirement: IPs must be hashed or stripped before reaching
// any log sink. Plain IPs must never appear in logs.
// Roadmap ref: D3 Gamaliel — "IP hashing middleware"
//              D7 Joel — "Confirm IP hashing active in logs"
// Retention: Anonymized metadata max 72 hours (policy in Section 3.2)
// ─────────────────────────────────────────────────────────────

/**
 * Returns a 16-char truncated SHA-256 hash of an IP address.
 * Irreversible — cannot be used to reconstruct the original IP.
 * Safe to write to logs.
 */
export function hashIP(rawIP: string): string {
  return createHash("sha256")
    .update(rawIP + (process.env.IP_HASH_SALT ?? "documenso-verify"))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Extracts the real client IP from a request, accounting for
 * reverse proxies. Returns a hashed value — never the raw IP.
 * Call this once at the route boundary; never store the raw IP.
 */
export function getHashedIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const raw = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  return hashIP(raw);
}

// ─────────────────────────────────────────────────────────────
// 5. RATE LIMITING
// PRD requirement: 100 requests/hour per IP.
// Roadmap DoD: "Rate limit confirmed: 101st request/hour returns 429"
// Note: In production, replace the in-memory map with a Redis-backed
// store (e.g. @upstash/ratelimit) for multi-instance deployments.
// ─────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number; // Unix ms timestamp
}

// Keyed by hashed IP — never by raw IP
const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMIT_MAX     = 100;
const RATE_LIMIT_WINDOW  = 60 * 60 * 1000; // 1 hour in ms

// Prune stale entries every 10 minutes to prevent memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 10 * 60 * 1000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Checks and increments the rate limit for a given hashed IP.
 * Pass the output of getHashedIP() — never a raw IP address.
 *
 * Returns: { allowed, remaining, resetAt }
 * - allowed: false when count > RATE_LIMIT_MAX (i.e., 101st request)
 * - remaining: requests left in the current window
 * - resetAt: Unix ms timestamp when the window resets
 */
export function checkRateLimit(hashedIP: string): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(hashedIP);

  if (!entry || now > entry.resetAt) {
    const newEntry: RateLimitEntry = { count: 1, resetAt: now + RATE_LIMIT_WINDOW };
    rateLimitStore.set(hashedIP, newEntry);
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetAt: newEntry.resetAt };
  }

  entry.count += 1;

  return {
    allowed: entry.count <= RATE_LIMIT_MAX,
    remaining: Math.max(0, RATE_LIMIT_MAX - entry.count),
    resetAt: entry.resetAt,
  };
}

// ─────────────────────────────────────────────────────────────
// 6. ERROR TYPES
// Typed errors allow the tRPC procedure to return structured
// error responses without leaking implementation details.
// ─────────────────────────────────────────────────────────────

export type VerifyErrorCode =
  | "INVALID_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "RATE_LIMITED"
  | "PARSE_FAILED"
  | "NO_SIGNATURE_FOUND";

export class VerifyInputError extends Error {
  public readonly code: VerifyErrorCode;
  constructor(code: VerifyErrorCode, message: string) {
    super(message);
    this.name = "VerifyInputError";
    this.code = code;
  }
}
