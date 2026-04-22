/**
 * security-hardening.checklist.ts
 * Documenso — Verification Portal (#1764)
 * Owner: Joel
 * Roadmap ref: D7 Joel — "Security hardening: confirm magic bytes, buf.fill(0),
 *              IP hashing, rate limit, pinned deps"
 *
 * Run this script on Day 7 to confirm all security requirements
 * from the PRD are met before Paula's D8 legal review.
 *
 * Usage: npx ts-node --project tsconfig.json security-hardening.checklist.ts
 *
 * Each test must PASS before the PR is submitted.
 * Any FAIL is a blocking bug — fix before D8.
 */

import {
  checkRateLimit,
  hashIP,
  isPDF,
  assertFileSize,
  zeroBuf,
} from '../server-only/verify/verify-utils';

// ─────────────────────────────────────────────────────────────
// TEST RUNNER
// ─────────────────────────────────────────────────────────────

type TestResult = { name: string; passed: boolean; detail?: string };

const results: TestResult[] = [];

const test = (name: string, fn: () => boolean | string): void => {
  try {
    const result = fn();
    const passed = result === true || result === 'pass';
    const detail = typeof result === 'string' && result !== 'pass' ? result : undefined;

    results.push({ name, passed: passed === true, detail });
  } catch (err) {
    results.push({ name, passed: false, detail: (err as Error).message });
  }
};

// ─────────────────────────────────────────────────────────────
// 1. MAGIC BYTES TESTS
// PRD: "%PDF- prefix check BEFORE any parsing library"
// ─────────────────────────────────────────────────────────────

test('Magic bytes: valid PDF buffer accepted', () => {
  const validPDF = Buffer.from('%PDF-1.7 fake content');

  return isPDF(validPDF) === true;
});

test('Magic bytes: PNG buffer rejected', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

  return isPDF(png) === false;
});

test('Magic bytes: DOCX (ZIP) buffer rejected', () => {
  const docx = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // PK zip magic

  return isPDF(docx) === false;
});

test('Magic bytes: empty buffer rejected', () => {
  return isPDF(Buffer.alloc(0)) === false;
});

test('Magic bytes: 4-byte buffer (too short) rejected', () => {
  return isPDF(Buffer.from('%PDF')) === false; // Only 4 bytes, need 5
});

// ─────────────────────────────────────────────────────────────
// 2. FILE SIZE TESTS
// PRD: "Reuse MAX_FILE_SIZE env variable. 10MB default."
// ─────────────────────────────────────────────────────────────

test('File size: 1MB PDF accepted', () => {
  const smallPDF = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(1024 * 1024)]);

  try {
    assertFileSize(smallPDF);

    return true;
  } catch {
    return false;
  }
});

test('File size: 10MB PDF accepted (at limit)', () => {
  const maxPDF = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(10 * 1024 * 1024 - 5)]);

  try {
    assertFileSize(maxPDF);

    return true;
  } catch {
    return false;
  }
});

test('File size: 10MB + 1 byte PDF rejected', () => {
  const overPDF = Buffer.alloc(10 * 1024 * 1024 + 1);

  try {
    assertFileSize(overPDF);

    return false;
  } catch {
    return true;
  }
});

// ─────────────────────────────────────────────────────────────
// 3. MEMORY ZEROING TESTS
// PRD: "buf.fill(0) actively zeroed — not just 'cleared'"
// D7: "Confirm buf.fill(0) fires in try/finally (test with profiler)"
// ─────────────────────────────────────────────────────────────

test('Memory zeroing: buffer is all zeros after zeroBuf()', () => {
  const buf = Buffer.from('%PDF-1.7 this is sensitive document content that must be erased');

  zeroBuf(buf);

  const allZero = buf.every((byte) => byte === 0);

  return allZero
    ? true
    : `Buffer not zeroed: first non-zero byte at position ${buf.indexOf(buf.find((b) => b !== 0)!)}`;
});

test('Memory zeroing: fires even when isPDF throws (try/finally simulation)', () => {
  const buf = Buffer.from('not a pdf');
  let zeroingFired = false;

  try {
    if (!isPDF(buf)) {
      throw new Error('Not a PDF');
    }
  } finally {
    zeroBuf(buf);
    zeroingFired = true;
  }

  return zeroingFired && buf.every((b) => b === 0);
});

test('Memory zeroing: length preserved after zeroing (no reallocation)', () => {
  const originalLength = 1024;
  const buf = Buffer.alloc(originalLength, 0xff);

  zeroBuf(buf);

  return buf.length === originalLength && buf.every((b) => b === 0);
});

// ─────────────────────────────────────────────────────────────
// 4. IP HASHING TESTS
// PRD: "IPs hashed/stripped before log sink. Plain IPs never in logs."
// D7: "Confirm IP hashing active in logs (check log output directly)"
// ─────────────────────────────────────────────────────────────

test('IP hashing: raw IP is not present in hash output', () => {
  const rawIP = '203.0.113.42';
  const hashed = hashIP(rawIP);

  return !hashed.includes(rawIP) && !hashed.includes('203');
});

test('IP hashing: output is 16 hex characters', () => {
  const hashed = hashIP('192.168.1.1');

  return /^[0-9a-f]{16}$/.test(hashed) ? true : `Got: ${hashed}`;
});

test('IP hashing: same IP produces same hash (deterministic)', () => {
  const ip = '198.51.100.5';

  return hashIP(ip) === hashIP(ip);
});

test('IP hashing: different IPs produce different hashes', () => {
  return hashIP('10.0.0.1') !== hashIP('10.0.0.2');
});

test('IP hashing: unknown/missing IP handled without throwing', () => {
  try {
    hashIP('unknown');

    return true;
  } catch {
    return false;
  }
});

// ─────────────────────────────────────────────────────────────
// 5. RATE LIMITING TESTS
// PRD: "100 requests/hour per IP"
// Roadmap DoD: "101st request/hour returns 429"
// ─────────────────────────────────────────────────────────────

test('Rate limiting: first 100 requests allowed', () => {
  const testIP = hashIP(`test-rate-limit-${Date.now()}`);
  let failedBefore100 = false;

  for (let i = 0; i < 100; i++) {
    const { allowed } = checkRateLimit(testIP);

    if (!allowed) {
      failedBefore100 = true;
      break;
    }
  }

  return !failedBefore100;
});

test('Rate limiting: 101st request blocked (returns allowed: false)', () => {
  const testIP = hashIP(`test-rate-101-${Date.now()}`);

  for (let i = 0; i < 100; i++) {
    checkRateLimit(testIP);
  }

  const { allowed } = checkRateLimit(testIP); // 101st

  return allowed === false;
});

test('Rate limiting: remaining count decrements correctly', () => {
  const testIP = hashIP(`test-remaining-${Date.now()}`);
  const first = checkRateLimit(testIP); // 1st request → 99 remaining
  const second = checkRateLimit(testIP); // 2nd request → 98 remaining

  return first.remaining === 99 && second.remaining === 98
    ? true
    : `Got remaining: ${first.remaining}, ${second.remaining}`;
});

test('Rate limiting: resetAt is approximately 1 hour in the future', () => {
  const testIP = hashIP(`test-reset-${Date.now()}`);
  const { resetAt } = checkRateLimit(testIP);
  const oneHourMs = 60 * 60 * 1000;
  const diff = resetAt - Date.now();

  // Allow 5 second tolerance for test execution time
  return diff > oneHourMs - 5000 && diff <= oneHourMs
    ? true
    : `resetAt diff: ${diff}ms (expected ~${oneHourMs}ms)`;
});

// ─────────────────────────────────────────────────────────────
// RESULTS SUMMARY
// ─────────────────────────────────────────────────────────────

const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;
const total = results.length;

console.log('\n────────────────────────────────────────────────');
console.log(' DOCUMENSO /verify — D7 Security Hardening Checklist');
console.log('────────────────────────────────────────────────\n');

results.forEach((r) => {
  const icon = r.passed ? '✓' : '✗';
  const color = r.passed ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';

  console.log(`${color}${icon}${reset}  ${r.name}`);

  if (r.detail) {
    console.log(`      Detail: ${r.detail}`);
  }
});

console.log(`\n────────────────────────────────────────────────`);
console.log(
  ` ${passed}/${total} passed   ${failed > 0 ? `\x1b[31m${failed} FAILED — blocking bugs\x1b[0m` : '\x1b[32mAll clear\x1b[0m'}`,
);
console.log(`────────────────────────────────────────────────\n`);

if (failed > 0) {
  console.log("⚠  Fix all failing tests before Paula's D8 legal review.");
  console.log('⚠  Do not submit the PR until this checklist is 100% green.\n');
  process.exit(1);
} else {
  console.log('✓  All security requirements confirmed. Ready for D8 review.\n');
  process.exit(0);
}
