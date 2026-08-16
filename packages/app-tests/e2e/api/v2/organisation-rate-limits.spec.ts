import fs from 'node:fs';
import path from 'node:path';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { prisma } from '@documenso/prisma';
import { EnvelopeType, RecipientRole } from '@documenso/prisma/client';
import { seedUser } from '@documenso/prisma/seed/users';
import type {
  TCreateEnvelopePayload,
  TCreateEnvelopeResponse,
} from '@documenso/trpc/server/envelope-router/create-envelope.types';
import { type APIRequestContext, type APIResponse, expect, test } from '@playwright/test';
import type { Organisation, Team, User } from '@prisma/client';

/**
 * Dynamic organisation rate-limit & quota tests.
 *
 * Covers the feature added in `feat: add dynamic rate limits`:
 *   - Three counters: `api`, `document`, `email`.
 *   - Two enforcement stages per counter:
 *       1. Windowed rate limits (`*RateLimits`) — 429 WITH `X-RateLimit-*` headers.
 *       2. Monthly quota (`*Quota`) — 429 WITHOUT rate-limit headers; a `null`
 *          quota means unlimited and a `0` quota is a hard block.
 *
 * Where each counter is consumed:
 *   api      -> every authenticated v2 request (get-api-token-by-token).
 *   document -> envelope create where type === DOCUMENT (count 1).
 *   email    -> redistribute/remind consumes `recipientsToRemind.length`
 *               SYNCHRONOUSLY (resend-document), so we can assert on the HTTP
 *               response rather than racing async signing-email jobs.
 *
 * --- WHY THIS TEST IS SKIPPED IN CI ---
 * CI runs E2E with `DANGEROUS_BYPASS_RATE_LIMITS=true`, which short-circuits BOTH
 * the per-org assertion and the global IP limiter, making every assertion here
 * meaningless. The test therefore skips itself in that mode and is intended to be
 * run deliberately and locally with the bypass OFF.
 *
 * --- GLOBAL LIMIT AWARENESS ---
 * apps/remix/server/router.ts applies a GLOBAL per-IP limiter to /api/v2/*:
 *   apiV2RateLimit = 100 requests / 1 minute (see rate-limits.ts).
 * Every per-org limit/quota configured here is kept FAR below that ceiling (single
 * digits) and the suite runs serially so the shared-IP global bucket is never the
 * thing that trips. A global-limit 429 is shaped `{ error }` whereas an org-limit
 * 429 is shaped `{ message }` — `expectOrgLimited()` asserts the 429 status AND
 * that we hit the org limiter rather than the global one.
 */

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2-beta`;

// Run serially: all workers share one IP, and the global /api/v2 limiter is
// per-IP. Serial execution keeps the shared global bucket well under 100/min.
test.describe.configure({ mode: 'serial' });

// This suite is only meaningful with real rate limiting enabled. CI sets the
// bypass flag, so skip there; run it locally with the bypass turned off.
test.skip(process.env.DANGEROUS_BYPASS_RATE_LIMITS === 'true', 'Test skipped because bypass rate limits is enabled.');

const examplePdfBuffer = fs.readFileSync(path.join(__dirname, '../../../../../assets/example.pdf'));

const WINDOWED_LIMIT_MESSAGE = /contact support if you require higher limits/i;
const NO_QUOTA_MESSAGE = /request could not be completed at this time/i;

// ---------------------------------------------------------------------------
// Claim / usage control (direct Prisma) — mirrors recipient-count-limit.spec.ts
// ---------------------------------------------------------------------------

type RateLimitEntry = { window: `${number}${'s' | 'm' | 'h' | 'd'}`; max: number };

type ClaimLimits = {
  apiRateLimits?: RateLimitEntry[];
  apiQuota?: number | null;
  documentRateLimits?: RateLimitEntry[];
  documentQuota?: number | null;
  emailRateLimits?: RateLimitEntry[];
  emailQuota?: number | null;
};

const currentMonthlyPeriod = (): string => {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');

  return `${now.getUTCFullYear()}-${month}`;
};

const getOrganisationClaim = async (team: Team) =>
  prisma.organisationClaim.findFirstOrThrow({
    where: { organisation: { id: team.organisationId } },
  });

/**
 * Apply a clean set of limits to the org's claim. Any counter not provided is
 * reset to "unlimited" (empty windows + null quota) so scenarios never leak into
 * each other.
 */
const setClaimLimits = async (team: Team, limits: ClaimLimits) => {
  const claim = await getOrganisationClaim(team);

  await prisma.organisationClaim.update({
    where: { id: claim.id },
    data: {
      apiRateLimits: limits.apiRateLimits ?? [],
      apiQuota: limits.apiQuota === undefined ? null : limits.apiQuota,
      documentRateLimits: limits.documentRateLimits ?? [],
      documentQuota: limits.documentQuota === undefined ? null : limits.documentQuota,
      emailRateLimits: limits.emailRateLimits ?? [],
      emailQuota: limits.emailQuota === undefined ? null : limits.emailQuota,
    },
  });
};

/**
 * Clear the monthly quota counters, the org windowed rate-limit buckets AND the
 * GLOBAL /api/v2 IP bucket so a fresh scenario starts from zero.
 *
 * - The org windowed limiter keys its rows `ip:org:<id>`.
 * - The GLOBAL limiter (apps/remix/server/router.ts -> apiV2RateLimit, 100/min
 *   per IP, action `api.v2`) is shared by EVERY v2 request from this test client.
 *   Across the suite (and especially across repeated local runs within the same
 *   minute) that shared bucket would otherwise fill up and trip BEFORE the org
 *   limit under test, producing a `{ error }` 429 instead of the org `{ message }`
 *   one. Since this suite runs deliberately in isolation (it skips in CI), we
 *   clear that bucket here so the global limiter never masks the org assertion.
 */
const resetUsage = async (organisation: Organisation) => {
  const period = currentMonthlyPeriod();

  await prisma.organisationMonthlyStat.updateMany({
    where: { organisationId: organisation.id, period },
    data: {
      documentCount: 0,
      emailCount: 0,
      apiCount: 0,
    },
  });

  await prisma.rateLimit.deleteMany({
    where: {
      OR: [{ key: `ip:org:${organisation.id}` }, { action: 'api.v2' }],
    },
  });
};

type MonthlyCounter = 'documentCount' | 'emailCount' | 'apiCount';

const getMonthlyStat = async (organisation: Organisation) =>
  prisma.organisationMonthlyStat.findUnique({
    where: {
      organisationId_period: { organisationId: organisation.id, period: currentMonthlyPeriod() },
    },
    select: { documentCount: true, emailCount: true, apiCount: true },
  });

/**
 * Assert the live OrganisationMonthlyStat counter equals `expected`.
 *
 * The DB counter is the source of truth for quota enforcement, so checking its
 * exact value (not just the HTTP response) proves the documented increment
 * semantics in check-monthly-quota.ts:
 *   - quota === null -> unlimited: never blocks, but the request is STILL
 *                       counted (the upsert now runs before the null return)
 *   - quota === 0    -> throws BEFORE increment (stays 0)
 *   - quota  >  0    -> incremented by `count` BEFORE the over-quota check, so
 *                       even the request that gets rejected still advances it
 *   - windowed limit -> trips BEFORE the quota stage, so the counter is untouched
 */
const expectMonthlyCounter = async (organisation: Organisation, counter: MonthlyCounter, expected: number) => {
  const stat = await getMonthlyStat(organisation);

  expect(stat?.[counter] ?? 0, `${counter} should be exactly ${expected}`).toBe(expected);
};

/**
 * Wait until a monthly counter reaches `atLeast` and then stops changing.
 *
 * `distribute` fans out one async signing-request email job per recipient (the
 * local job runner fires them via fire-and-forget HTTP, so they complete after
 * the call returns). Each job increments emailCount. We poll until the counter
 * has reached the expected floor AND is stable across consecutive reads, which
 * guarantees no late job will increment the counter after the caller resets
 * usage — making the subsequent (synchronous) redistribute assertions exact.
 */
const waitForCounterToSettle = async (
  organisation: Organisation,
  counter: MonthlyCounter,
  atLeast: number,
  timeoutMs = 20_000,
): Promise<number> => {
  const start = Date.now();
  let previous = -1;

  while (Date.now() - start < timeoutMs) {
    const stat = await getMonthlyStat(organisation);
    const current = stat?.[counter] ?? 0;

    if (current >= atLeast && current === previous) {
      return current;
    }

    previous = current;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${counter} to settle at >= ${atLeast}`);
};

/**
 * Sleep until just after the next windowed-limit bucket boundary.
 *
 * The limiter (createRateLimit -> getBucket) buckets time as
 * `now - (now % windowMs)` aligned to the epoch. A windowed exhaustion test must
 * land all of its MAX+1 requests inside ONE bucket; if the requests straddle a
 * boundary the counter resets mid-test and the expected 429 never happens. We
 * share the server's clock (same host), so aligning to a fresh bucket here makes
 * the exhaustion deterministic.
 */
const alignToFreshWindowBucket = async (windowSeconds: number) => {
  const windowMs = windowSeconds * 1000;
  const msUntilNextBucket = windowMs - (Date.now() % windowMs);

  await new Promise((resolve) => setTimeout(resolve, msUntilNextBucket + 100));
};

/**
 * Guarantee at least `requiredHeadroomMs` remain in the current bucket so a burst
 * of MAX+1 requests completes inside ONE window. Without this, a burst that
 * happens to cross a bucket boundary would have its count reset mid-test and the
 * expected 429 would never fire. Unlike `alignToFreshWindowBucket`, this only
 * sleeps when we are actually near a boundary, so for long (e.g. 1m) windows it
 * is almost always a no-op.
 */
const ensureWindowHeadroom = async (windowSeconds: number, requiredHeadroomMs: number) => {
  const windowMs = windowSeconds * 1000;
  const msLeftInBucket = windowMs - (Date.now() % windowMs);

  if (msLeftInBucket < requiredHeadroomMs) {
    await new Promise((resolve) => setTimeout(resolve, msLeftInBucket + 100));
  }
};

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

type ApiErrorBody = { message?: string; error?: string };

/**
 * Non-throwing predicate: true when the response is an ORG-level 429
 * (`{ message }`), not the global IP 429 (`{ error }`). Used by the preflight,
 * which needs a boolean to decide whether to skip rather than fail.
 */
const isOrgLimited = async (res: APIResponse): Promise<boolean> => {
  if (res.status() !== 429) {
    return false;
  }

  const body = (await res.json().catch(() => ({}))) as ApiErrorBody;

  // Global limiter returns `{ error }`; org limiter returns `{ message }`.
  return body.message !== undefined && body.error === undefined;
};

/**
 * Assert the response is an ORG-level 429 and return its parsed body.
 *
 * Checks the status code EXPLICITLY so a wrong 200/4xx fails with a clear
 * "Expected 429, got <status>: <body>" message instead of an opaque
 * `expected true, received false`. Also asserts the body is the org limiter's
 * `{ message }` shape and not the global limiter's `{ error }` shape, so a
 * global-IP 429 can never be mistaken for the org limit under test.
 */
const expectOrgLimited = async (res: APIResponse): Promise<ApiErrorBody> => {
  const bodyText = await res.text();

  expect(res.status(), `Expected an org 429 but got ${res.status()} with body: ${bodyText}`).toBe(429);

  let body: ApiErrorBody = {};

  try {
    body = JSON.parse(bodyText) as ApiErrorBody;
  } catch {
    throw new Error(`Expected a JSON error body, got: ${bodyText}`);
  }

  expect(
    body.message !== undefined && body.error === undefined,
    `429 should be the ORG limiter ({ message }), not the global limiter ({ error }). Got: ${bodyText}`,
  ).toBeTruthy();

  return body;
};

/**
 * Assert the org windowed-limit value is present in `X-RateLimit-Limit`.
 *
 * Two limiters set this header: the GLOBAL /api/v2 middleware (max 100) sets it
 * first, then the org limiter's AppError sets it to the org `max`. Playwright
 * surfaces duplicate headers joined by ", " (e.g. "100, 4"), so we assert the
 * org value is one of the comma-separated entries rather than an exact match.
 */
const expectRateLimitHeaderToInclude = (res: APIResponse, expectedMax: number) => {
  const header = res.headers()['x-ratelimit-limit'] ?? '';
  const values = header.split(',').map((v) => v.trim());

  expect(values, `X-RateLimit-Limit "${header}" should include the org max ${expectedMax}`).toContain(
    String(expectedMax),
  );
};

/**
 * Assert NO org rate-limit header was added — used for quota rejections, which
 * intentionally omit rate-limit headers (a quota isn't a window). The GLOBAL
 * middleware still stamps a single `X-RateLimit-Limit: 100`, so "no org header"
 * means the value is either absent or exactly the lone global `100` (i.e. it does
 * not contain a second, org-specific entry).
 */
const expectNoOrgRateLimitHeader = (res: APIResponse) => {
  const header = res.headers()['x-ratelimit-limit'];

  if (header === undefined) {
    return;
  }

  const values = header.split(',').map((v) => v.trim());

  expect(values, `Quota rejection should not add an org X-RateLimit-Limit, got "${header}"`).toEqual(['100']);
};

/** Guard against the global limiter silently masking an org assertion. */
const expectNotGlobalLimited = async (res: APIResponse) => {
  if (res.status() === 429) {
    const body = await res.json().catch(() => ({}));

    expect(
      'error' in body && !('message' in body),
      'Hit the GLOBAL /api/v2 IP limiter, not the org limiter. Re-run this suite in isolation.',
    ).toBeFalsy();
  }
};

/** Cheap read endpoint — consumes exactly one `api` counter, no document/email. */
const findEnvelopes = (request: APIRequestContext, token: string): Promise<APIResponse> =>
  request.get(`${baseUrl}/envelope?perPage=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });

/**
 * Create a DOCUMENT envelope. Consumes one `api` counter and, when
 * `type === DOCUMENT`, one `document` counter. Optionally seeds SIGNER recipients
 * (each with a signature field) so the envelope can later be distributed.
 */
const createEnvelope = async (
  request: APIRequestContext,
  token: string,
  options: { recipientCount?: number } = {},
): Promise<APIResponse> => {
  const { recipientCount = 0 } = options;

  const payload: TCreateEnvelopePayload = {
    title: `Rate limit test ${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: EnvelopeType.DOCUMENT,
    recipients:
      recipientCount > 0
        ? Array.from({ length: recipientCount }, (_, i) => ({
            email: `rl-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}@test.documenso.com`,
            name: `Recipient ${i}`,
            role: RecipientRole.SIGNER,
            signingOrder: i + 1,
            accessAuth: [],
            actionAuth: [],
            fields: [
              {
                type: 'SIGNATURE',
                fieldMeta: { type: 'signature', overflow: 'crop' },
                identifier: 0,
                page: 1,
                positionX: 10,
                positionY: 80,
                width: 20,
                height: 5,
              },
            ],
          }))
        : undefined,
    meta: {
      subject: 'Rate limit test',
      message: 'Automated rate-limit test. Ignore.',
      distributionMethod: 'EMAIL',
    },
  };

  const formData = new FormData();
  formData.append('payload', JSON.stringify(payload));
  formData.append('files', new File([examplePdfBuffer], 'example.pdf', { type: 'application/pdf' }));

  return request.post(`${baseUrl}/envelope/create`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: formData,
  });
};

/** Distribute an envelope to all of its recipients via EMAIL. */
const distributeEnvelope = (request: APIRequestContext, token: string, envelopeId: string): Promise<APIResponse> =>
  request.post(`${baseUrl}/envelope/distribute`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      envelopeId,
      meta: { distributionMethod: 'EMAIL', subject: 'Rate limit test', message: 'Rate limit test' },
    },
  });

/**
 * Redistribute (remind) the given recipients. This runs the SYNCHRONOUS email
 * assertion in resend-document with `count = recipients.length`, returning a 429
 * directly when the email limit/quota is exceeded.
 */
const redistributeEnvelope = (
  request: APIRequestContext,
  token: string,
  envelopeId: string,
  recipientIds: number[],
): Promise<APIResponse> =>
  request.post(`${baseUrl}/envelope/redistribute`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { envelopeId, recipients: recipientIds },
  });

/**
 * Build a fully-distributed envelope and return its NOT_SIGNED recipient IDs so a
 * subsequent redistribute can exercise the synchronous email assertion.
 *
 * Setup uses a GENEROUS email quota so the async signing-request emails fanned out
 * by `distribute` are counted, then waits for that counter to settle. This drains
 * the background jobs BEFORE the caller resets usage, so they can't pollute
 * emailCount mid-test. The caller then configures the email limit/quota under test
 * and resets usage, so only the (synchronous, deterministic) redistribute counts.
 */
const seedDistributedEnvelope = async ({
  request,
  token,
  team,
  organisation,
  recipientCount,
}: {
  request: APIRequestContext;
  token: string;
  team: Team;
  organisation: Organisation;
  recipientCount: number;
}): Promise<{ envelopeId: string; recipientIds: number[] }> => {
  await setClaimLimits(team, { emailQuota: 1000 });
  await resetUsage(organisation);

  const createRes = await createEnvelope(request, token, { recipientCount });
  expect(createRes.ok(), `create failed: ${await createRes.text()}`).toBeTruthy();
  const { id: envelopeId } = (await createRes.json()) as TCreateEnvelopeResponse;

  const distributeRes = await distributeEnvelope(request, token, envelopeId);
  expect(distributeRes.ok(), `distribute failed: ${await distributeRes.text()}`).toBeTruthy();

  const recipients = await prisma.recipient.findMany({
    where: { envelopeId },
    select: { id: true },
  });

  // Drain the async signing-request email jobs (one per recipient) so a late job
  // cannot increment emailCount after the caller's resetUsage.
  await waitForCounterToSettle(organisation, 'emailCount', recipientCount);

  return { envelopeId, recipientIds: recipients.map((r) => r.id) };
};

// ===========================================================================
// Tests
// ===========================================================================

test.describe('Organisation dynamic rate limits & quotas', () => {
  let user: User;
  let team: Team;
  let organisation: Organisation;
  let token: string;

  test.beforeEach(async ({ request }) => {
    const seeded = await seedUser();
    user = seeded.user;
    team = seeded.team;
    organisation = seeded.organisation;

    ({ token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test-org-rate-limits',
      expiresIn: null,
    }));

    // Preflight: the `test.skip` above only sees the PLAYWRIGHT process env. The
    // value that actually matters is the env the SERVER was started with — if the
    // server has `DANGEROUS_BYPASS_RATE_LIMITS=true`, every assertion here would
    // fail confusingly instead of skipping. Prove enforcement is live by setting a
    // quota of 0 (instant hard block) and confirming the server rejects. If it
    // doesn't, the server is bypassing limits, so skip with a clear message.
    await setClaimLimits(team, { apiQuota: 0 });
    await resetUsage(organisation);

    const preflight = await findEnvelopes(request, token);
    const enforced = await isOrgLimited(preflight);

    // Reset back to a clean slate before the real scenario runs.
    await setClaimLimits(team, {});
    await resetUsage(organisation);

    test.skip(
      !enforced,
      'Server is not enforcing organisation rate limits (likely started with DANGEROUS_BYPASS_RATE_LIMITS=true). Restart the server with the flag unset/false to run this suite.',
    );
  });

  // =========================================================================
  // API counter — windowed rate limit
  // =========================================================================

  test.describe('api rate limit (windowed)', () => {
    test('allows requests up to the limit then 429s with rate-limit headers', async ({ request }) => {
      const MAX = 4;
      await setClaimLimits(team, { apiRateLimits: [{ window: '1m', max: MAX }] });
      await resetUsage(organisation);

      // Make sure the MAX+1 request burst lands inside a single 1m bucket.
      await ensureWindowHeadroom(60, 10_000);

      // Each request (including these GETs) consumes one api counter.
      for (let i = 0; i < MAX; i += 1) {
        const res = await findEnvelopes(request, token);
        await expectNotGlobalLimited(res);
        expect(res.status(), `request #${i + 1} should be allowed`).toBe(200);
      }

      // The next request is over the windowed limit.
      const limitedRes = await findEnvelopes(request, token);
      const body = await expectOrgLimited(limitedRes);
      // The windowed limit uses a message distinct from the global limiter.
      expect(String(body.message)).toMatch(WINDOWED_LIMIT_MESSAGE);
      expectRateLimitHeaderToInclude(limitedRes, MAX);
      expect(limitedRes.headers()['x-ratelimit-remaining']).toContain('0');
      expect(limitedRes.headers()['retry-after']).toBeTruthy();

      // The windowed stage blocks the (MAX+1)th request before the quota upsert,
      // but each of the MAX allowed requests still records usage (null quota now
      // tracks instead of skipping), so the counter equals MAX.
      await expectMonthlyCounter(organisation, 'apiCount', MAX);
    });

    test('a single allowed request succeeds when the limit is 1', async ({ request }) => {
      await setClaimLimits(team, { apiRateLimits: [{ window: '1m', max: 1 }] });
      await resetUsage(organisation);

      // Make sure both requests land inside a single 1m bucket.
      await ensureWindowHeadroom(60, 10_000);

      const okRes = await findEnvelopes(request, token);
      await expectNotGlobalLimited(okRes);
      expect(okRes.status()).toBe(200);

      const limitedRes = await findEnvelopes(request, token);
      const body = await expectOrgLimited(limitedRes);
      expect(String(body.message)).toMatch(WINDOWED_LIMIT_MESSAGE);

      // The one allowed request is counted (null quota still tracks); the blocked
      // request trips the window before the quota upsert, so the counter is 1.
      await expectMonthlyCounter(organisation, 'apiCount', 1);
    });

    test('the windowed limit RESETS once the window elapses (429 -> wait -> 200)', async ({ request }) => {
      const MAX = 2;
      const WINDOW_SECONDS = 3;
      await setClaimLimits(team, { apiRateLimits: [{ window: `${WINDOW_SECONDS}s`, max: MAX }] });
      await resetUsage(organisation);

      // Land at the start of a fresh bucket so all MAX+1 requests below fall in
      // the SAME window (otherwise a mid-exhaustion boundary would reset the count).
      await alignToFreshWindowBucket(WINDOW_SECONDS);

      // Exhaust the window.
      for (let i = 0; i < MAX; i += 1) {
        const res = await findEnvelopes(request, token);
        await expectNotGlobalLimited(res);
        expect(res.status(), `request #${i + 1} should be allowed`).toBe(200);
      }

      // The next request is blocked by the window.
      const limitedRes = await findEnvelopes(request, token);
      await expectOrgLimited(limitedRes);

      // Wait out the window using the server-provided Retry-After (plus a small
      // buffer to be sure we've crossed into the next time bucket). Crucially we
      // do NOT reset usage here — the limiter must recover on its own as the
      // bucket rolls over.
      const retryAfterHeader = limitedRes.headers()['retry-after'] ?? String(WINDOW_SECONDS);
      const retryAfterSeconds = Number.parseInt(retryAfterHeader.split(',')[0]?.trim() ?? '', 10) || WINDOW_SECONDS;
      await new Promise((resolve) => setTimeout(resolve, (retryAfterSeconds + 1) * 1000));

      // Window has elapsed: the same org can make requests again without any
      // manual intervention — the bucket rolled over on its own.
      const afterReset = await findEnvelopes(request, token);
      await expectNotGlobalLimited(afterReset);
      expect(afterReset.status(), 'request after the window elapsed should be allowed').toBe(200);
    });
  });

  // =========================================================================
  // API counter — monthly quota
  // =========================================================================

  test.describe('api quota (monthly)', () => {
    test('null quota allows unlimited requests', async ({ request }) => {
      await setClaimLimits(team, { apiQuota: null });
      await resetUsage(organisation);

      for (let i = 0; i < 6; i += 1) {
        const res = await findEnvelopes(request, token);
        await expectNotGlobalLimited(res);
        expect(res.status()).toBe(200);
      }

      // A null quota means "unlimited" (never blocks), but every request is now
      // recorded so usage is visible on unlimited plans — so the counter is 6.
      await expectMonthlyCounter(organisation, 'apiCount', 6);
    });

    test('exhausting the quota 429s without rate-limit headers and keeps counting', async ({ request }) => {
      const QUOTA = 3;
      await setClaimLimits(team, { apiQuota: QUOTA });
      await resetUsage(organisation);

      for (let i = 0; i < QUOTA; i += 1) {
        const res = await findEnvelopes(request, token);
        await expectNotGlobalLimited(res);
        expect(res.status(), `request #${i + 1} should be within quota`).toBe(200);
      }

      const limitedRes = await findEnvelopes(request, token);
      const body = await expectOrgLimited(limitedRes);
      expect(String(body.message)).toMatch(NO_QUOTA_MESSAGE);

      // Quota rejections deliberately omit rate-limit headers (it isn't a window).
      expectNoOrgRateLimitHeader(limitedRes);

      // The atomic increment runs even on the rejected request: QUOTA allowed
      // requests + the one rejected request = exactly QUOTA + 1.
      await expectMonthlyCounter(organisation, 'apiCount', QUOTA + 1);
    });

    test('quota of exactly 1 allows one request then blocks', async ({ request }) => {
      await setClaimLimits(team, { apiQuota: 1 });
      await resetUsage(organisation);

      const okRes = await findEnvelopes(request, token);
      await expectNotGlobalLimited(okRes);
      expect(okRes.status()).toBe(200);

      const limitedRes = await findEnvelopes(request, token);
      await expectOrgLimited(limitedRes);

      // One allowed + one rejected, both incremented => exactly 2.
      await expectMonthlyCounter(organisation, 'apiCount', 2);
    });

    test('quota of 0 is a hard block with a "no quota available" message', async ({ request }) => {
      await setClaimLimits(team, { apiQuota: 0 });
      await resetUsage(organisation);

      const limitedRes = await findEnvelopes(request, token);
      const body = await expectOrgLimited(limitedRes);
      expect(String(body.message)).toMatch(NO_QUOTA_MESSAGE);

      // quota === 0 throws before the increment, so the counter stays at zero.
      await expectMonthlyCounter(organisation, 'apiCount', 0);
    });
  });

  // =========================================================================
  // Document counter — windowed rate limit
  // =========================================================================

  test.describe('document rate limit (windowed)', () => {
    test('allows creates up to the limit then 429s with headers', async ({ request }) => {
      const MAX = 3;
      // Keep api unlimited so only the document stage can trip.
      await setClaimLimits(team, { documentRateLimits: [{ window: '1m', max: MAX }] });
      await resetUsage(organisation);

      // Make sure the MAX+1 create burst lands inside a single 1m bucket.
      await ensureWindowHeadroom(60, 10_000);

      for (let i = 0; i < MAX; i += 1) {
        const res = await createEnvelope(request, token);
        await expectNotGlobalLimited(res);
        expect(res.ok(), `create #${i + 1} should succeed`).toBeTruthy();
      }

      const limitedRes = await createEnvelope(request, token);
      const body = await expectOrgLimited(limitedRes);
      expect(String(body.message)).toMatch(WINDOWED_LIMIT_MESSAGE);
      expectRateLimitHeaderToInclude(limitedRes, MAX);
      expect(limitedRes.headers()['retry-after']).toBeTruthy();

      // The (MAX+1)th create trips the window before the quota upsert, but each of
      // the MAX allowed creates still records usage (null quota now tracks).
      await expectMonthlyCounter(organisation, 'documentCount', MAX);
    });
  });

  // =========================================================================
  // Document counter — monthly quota
  // =========================================================================

  test.describe('document quota (monthly)', () => {
    test('exhausting the document quota blocks further creates', async ({ request }) => {
      const QUOTA = 2;
      await setClaimLimits(team, { documentQuota: QUOTA });
      await resetUsage(organisation);

      for (let i = 0; i < QUOTA; i += 1) {
        const res = await createEnvelope(request, token);
        await expectNotGlobalLimited(res);
        expect(res.ok(), `create #${i + 1} should be within quota`).toBeTruthy();
      }

      const limitedRes = await createEnvelope(request, token);
      await expectOrgLimited(limitedRes);

      // QUOTA successful creates + the rejected one (incremented before throwing).
      await expectMonthlyCounter(organisation, 'documentCount', QUOTA + 1);
    });

    test('document quota of 0 hard-blocks creation', async ({ request }) => {
      await setClaimLimits(team, { documentQuota: 0 });
      await resetUsage(organisation);

      const limitedRes = await createEnvelope(request, token);
      const body = await expectOrgLimited(limitedRes);
      expect(String(body.message)).toMatch(NO_QUOTA_MESSAGE);

      // quota === 0 throws before the increment, so the counter stays at zero.
      await expectMonthlyCounter(organisation, 'documentCount', 0);
    });

    test('null document quota allows creation', async ({ request }) => {
      await setClaimLimits(team, { documentQuota: null });
      await resetUsage(organisation);

      const res = await createEnvelope(request, token);
      await expectNotGlobalLimited(res);
      expect(res.ok()).toBeTruthy();

      // A null quota is unlimited (never blocks) but is now still recorded, so the
      // single create advances the counter to 1.
      await expectMonthlyCounter(organisation, 'documentCount', 1);
    });
  });

  // =========================================================================
  // Email counter — windowed rate limit (via synchronous redistribute)
  // =========================================================================

  test.describe('email rate limit (windowed)', () => {
    test('redistribute is allowed when recipient count is within the email window', async ({ request }) => {
      const { envelopeId, recipientIds } = await seedDistributedEnvelope({
        request,
        token,
        team,
        organisation,
        recipientCount: 2,
      });

      // Window allows 5/min; reminding 2 recipients is fine. Reset usage so the
      // create/distribute consumption above doesn't count against this window.
      await setClaimLimits(team, { emailRateLimits: [{ window: '1m', max: 5 }] });
      await resetUsage(organisation);

      const res = await redistributeEnvelope(request, token, envelopeId, recipientIds);
      await expectNotGlobalLimited(res);
      expect(res.ok(), `redistribute should succeed: ${await res.text()}`).toBeTruthy();

      // The windowed pass is now recorded even though the quota is null, so the
      // counter advances by the batch size (recipientIds.length).
      await expectMonthlyCounter(organisation, 'emailCount', recipientIds.length);
    });

    test('redistribute is blocked when recipient count exceeds the email window', async ({ request }) => {
      const { envelopeId, recipientIds } = await seedDistributedEnvelope({
        request,
        token,
        team,
        organisation,
        recipientCount: 3,
      });

      // Window only allows 2 emails per minute; reminding 3 at once exceeds it.
      await setClaimLimits(team, { emailRateLimits: [{ window: '1m', max: 2 }] });
      await resetUsage(organisation);

      const res = await redistributeEnvelope(request, token, envelopeId, recipientIds);
      const body = await expectOrgLimited(res);
      expect(String(body.message)).toMatch(WINDOWED_LIMIT_MESSAGE);
      expectRateLimitHeaderToInclude(res, 2);

      // Windowed limit trips BEFORE the quota stage, so the counter is untouched.
      await expectMonthlyCounter(organisation, 'emailCount', 0);
    });
  });

  // =========================================================================
  // Email counter — monthly quota (via synchronous redistribute)
  // =========================================================================

  test.describe('email quota (monthly)', () => {
    test('redistribute within the remaining email quota succeeds', async ({ request }) => {
      const { envelopeId, recipientIds } = await seedDistributedEnvelope({
        request,
        token,
        team,
        organisation,
        recipientCount: 2,
      });

      await setClaimLimits(team, { emailQuota: 10 });
      await resetUsage(organisation);

      const res = await redistributeEnvelope(request, token, envelopeId, recipientIds);
      await expectNotGlobalLimited(res);
      expect(res.ok(), `redistribute should succeed: ${await res.text()}`).toBeTruthy();

      // The synchronous assertion consumed exactly `recipientIds.length` of quota.
      await expectMonthlyCounter(organisation, 'emailCount', recipientIds.length);
    });

    test('redistribute that would exceed the email quota is blocked', async ({ request }) => {
      const { envelopeId, recipientIds } = await seedDistributedEnvelope({
        request,
        token,
        team,
        organisation,
        recipientCount: 3,
      });

      // Quota of 2 but reminding 3 recipients in one synchronous call.
      await setClaimLimits(team, { emailQuota: 2 });
      await resetUsage(organisation);

      const res = await redistributeEnvelope(request, token, envelopeId, recipientIds);
      const body = await expectOrgLimited(res);
      expect(String(body.message)).toMatch(NO_QUOTA_MESSAGE);

      // Quota rejection carries no rate-limit headers.
      expectNoOrgRateLimitHeader(res);

      // The count (3) is added BEFORE the over-quota check throws, so the counter
      // advances by the full batch even though the request was rejected.
      await expectMonthlyCounter(organisation, 'emailCount', recipientIds.length);
    });

    test('email quota of 0 hard-blocks reminders', async ({ request }) => {
      const { envelopeId, recipientIds } = await seedDistributedEnvelope({
        request,
        token,
        team,
        organisation,
        recipientCount: 1,
      });

      await setClaimLimits(team, { emailQuota: 0 });
      await resetUsage(organisation);

      const res = await redistributeEnvelope(request, token, envelopeId, recipientIds);
      const body = await expectOrgLimited(res);
      expect(String(body.message)).toMatch(NO_QUOTA_MESSAGE);

      // quota === 0 throws before the increment, so the counter stays at zero.
      await expectMonthlyCounter(organisation, 'emailCount', 0);
    });
  });

  // =========================================================================
  // Stage interaction — quota binds before a looser window
  // =========================================================================

  test.describe('stage interaction', () => {
    test('the quota trips before a looser windowed limit', async ({ request }) => {
      const WINDOW_MAX = 50; // generous window
      const QUOTA = 2; // strict quota — should bind first
      await setClaimLimits(team, {
        apiRateLimits: [{ window: '1m', max: WINDOW_MAX }],
        apiQuota: QUOTA,
      });
      await resetUsage(organisation);

      for (let i = 0; i < QUOTA; i += 1) {
        const res = await findEnvelopes(request, token);
        await expectNotGlobalLimited(res);
        expect(res.status()).toBe(200);
      }

      const limitedRes = await findEnvelopes(request, token);
      const body = await expectOrgLimited(limitedRes);

      // It must be the QUOTA that bound, not the window: the message is the quota
      // one (not the windowed-limit message) and there are no rate-limit headers.
      expect(String(body.message)).toMatch(NO_QUOTA_MESSAGE);
      expect(String(body.message)).not.toMatch(WINDOWED_LIMIT_MESSAGE);
      expectNoOrgRateLimitHeader(limitedRes);

      // Quota bound at QUOTA + 1; the looser window (50) was never the limiter.
      await expectMonthlyCounter(organisation, 'apiCount', QUOTA + 1);
    });
  });
});
