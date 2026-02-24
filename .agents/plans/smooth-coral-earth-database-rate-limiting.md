---
date: 2026-02-19
title: Database Rate Limiting
---

## Summary

Replace the in-memory `hono-rate-limiter` with a database-backed rate limiting system using Prisma and PostgreSQL. The current in-memory approach is ineffective in multi-instance deployments since there are no sticky sessions. The new system uses **bucketed counters** (one row per key/action/time-bucket with atomic increment) to efficiently handle both high-throughput API rate limiting and granular auth/email rate limiting.

### Design Decisions

- **Bucketed counters** over row-per-request: high-throughput consumers would create thousands of rows per minute; bucketed counters reduce this to one row per key per time bucket
- **Fixed time windows**: simpler than sliding windows, the 2x burst-at-boundary scenario is acceptable for rate limiting purposes
- **Dual-key rate limiting**: per-identifier (`max`) and per-IP (`globalMax`) checked independently via separate rows with a `key` prefix (`id:` / `ip:`)
- **Accept slight over-count**: the upsert is atomic (increment + return count in one operation) but concurrent requests near the limit may both see a count just under the threshold before either commits, allowing a slight overshoot
- **Fail-open on errors**: if the rate limit DB query fails, allow the request through rather than blocking legitimate users
- **Prisma upsert** with `{ increment: 1 }` for atomic counter updates, returns the updated row so count check is a single operation
- **Application cron job** for cleanup of expired bucket rows

### Rate Limit Check Flow

```
check({ ip, identifier }) ->
  1. Upsert IP row (ip:{ip} / action / bucket) with count + 1, RETURNING count
     -> if globalMax is set and count >= globalMax, return { isLimited: true }
  2. Upsert identifier row (id:{identifier} / action / bucket) with count + 1, RETURNING count
     -> if count >= max, return { isLimited: true }
  3. Neither limited -> return { isLimited: false }
```

Each upsert atomically increments and returns the new count in a single operation. Both counters always increment on every check — there's no conditional logic to skip one based on the other. This keeps the implementation simple and avoids read-then-write race conditions. If only IP is provided (API rate limiting), only step 1 runs.

---

## 1. Database Schema

### 1.1 Prisma model

Add to `packages/prisma/schema.prisma` after the `Counter` model:

```prisma
model RateLimit {
  key       String
  action    String
  bucket    DateTime
  count     Int      @default(1)

  createdAt DateTime @default(now())

  @@id([key, action, bucket])
  @@index([createdAt])
}
```

- **Composite primary key** `(key, action, bucket)` serves as both the unique constraint for upserts and the lookup index
- **`key`** is prefixed: `ip:1.2.3.4` or `id:user@example.com`
- **`action`** is the rate limit action name: `auth.forgot-password`, `api.v1`, etc.
- **`bucket`** is the start of the time window, truncated to the window size (e.g., `2026-02-19T10:05:00Z` for a 5-minute bucket)
- **`createdAt` index** is for the cleanup job to efficiently delete old rows
- **`count`** starts at 1 (set by the create side of the upsert)

### 1.2 Migration

Generate with `npx prisma migrate dev --name add-rate-limits`.

---

## 2. Rate Limit Library

### 2.1 Core module

Create `packages/lib/server-only/rate-limit/rate-limit.ts`:

```typescript
type WindowUnit = 's' | 'm' | 'h' | 'd';
type WindowStr = `${number}${WindowUnit}`;

type RateLimitConfig = {
  action: string;
  max: number;
  globalMax?: number;
  window: WindowStr;
};

type CheckParams = {
  ip: string;
  identifier?: string;
};

export const rateLimit = (config: RateLimitConfig) => {
  return {
    async check(params: CheckParams): Promise<{
      isLimited: boolean;
      remaining: number;
      limit: number;
      reset: Date;
    }> { ... }
  };
};
```

### 2.2 Window parsing and bucket computation

```typescript
const parseWindow = (window: WindowStr): number => {
  const value = parseInt(window.slice(0, -1), 10);
  const unit = window.slice(-1) as WindowUnit;
  const multipliers: Record<WindowUnit, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * multipliers[unit];
};

const getBucket = (windowMs: number): Date => {
  const now = Date.now();
  return new Date(now - (now % windowMs));
};
```

### 2.3 Check implementation

The `check()` method:

1. Compute the current bucket from the window
2. Compute `reset` as `bucket + windowMs` (the start of the next window)
3. If `globalMax` is set, upsert the IP row and check count
4. If `identifier` is provided, upsert the identifier row and check count
5. Wrap in try/catch — **fail-open** on any database error (log the error, return `{ isLimited: false }`)

Each upsert uses Prisma's `upsert` with `{ increment: 1 }`:

```typescript
const result = await prisma.rateLimit.upsert({
  where: {
    key_action_bucket: {
      key: `ip:${params.ip}`,
      action: config.action,
      bucket,
    },
  },
  create: {
    key: `ip:${params.ip}`,
    action: config.action,
    bucket,
    count: 1,
  },
  update: {
    count: { increment: 1 },
  },
});

if (config.globalMax && result.count >= config.globalMax) {
  return { isLimited: true, remaining: 0, limit: config.globalMax };
}
```

### 2.4 Rate limit definitions

Create `packages/lib/server-only/rate-limit/rate-limits.ts` with all rate limit instances:

```typescript
// ---- Auth (Tier 1 - Critical, sends emails) ----
export const signupRateLimit = rateLimit({
  action: 'auth.signup',
  max: 5,
  globalMax: 10,
  window: '1h',
});

export const forgotPasswordRateLimit = rateLimit({
  action: 'auth.forgot-password',
  max: 3,
  globalMax: 20,
  window: '1h',
});

export const resendVerifyEmailRateLimit = rateLimit({
  action: 'auth.resend-verify-email',
  max: 3,
  globalMax: 20,
  window: '1h',
});

export const request2FAEmailRateLimit = rateLimit({
  action: 'auth.request-2fa-email',
  max: 5,
  globalMax: 20,
  window: '15m',
});

// ---- Auth (Tier 2 - Unauthenticated) ----
export const loginRateLimit = rateLimit({
  action: 'auth.login',
  max: 10,
  globalMax: 50,
  window: '15m',
});

export const resetPasswordRateLimit = rateLimit({
  action: 'auth.reset-password',
  max: 5,
  globalMax: 20,
  window: '1h',
});

export const verifyEmailRateLimit = rateLimit({
  action: 'auth.verify-email',
  max: 5,
  globalMax: 20,
  window: '15m',
});

export const passkeyRateLimit = rateLimit({
  action: 'auth.passkey',
  max: 10,
  globalMax: 50,
  window: '15m',
});

export const oauthRateLimit = rateLimit({
  action: 'auth.oauth',
  max: 10,
  globalMax: 50,
  window: '15m',
});

export const linkOrgAccountRateLimit = rateLimit({
  action: 'auth.link-org-account',
  max: 5,
  globalMax: 20,
  window: '1h',
});

// ---- API (Tier 4 - Standard) ----
export const apiV1RateLimit = rateLimit({
  action: 'api.v1',
  max: 100,
  window: '1m',
});

export const apiV2RateLimit = rateLimit({
  action: 'api.v2',
  max: 100,
  window: '1m',
});

export const apiTrpcRateLimit = rateLimit({
  action: 'api.trpc',
  max: 100,
  window: '1m',
});

export const aiRateLimit = rateLimit({
  action: 'api.ai',
  max: 3,
  window: '1m',
});

export const fileUploadRateLimit = rateLimit({
  action: 'api.file-upload',
  max: 20,
  window: '1m',
});
```

Exact limits are initial values — tune based on observed traffic patterns. These should be easy to adjust.

---

## 3. Integration Points

### 3.1 Hono middleware for API routes

Create a reusable Hono middleware factory in `packages/lib/server-only/rate-limit/rate-limit-middleware.ts` that wraps the `rateLimit` checker into Hono middleware:

```typescript
import { type MiddlewareHandler } from 'hono';

import { getIpAddress } from '@documenso/lib/universal/get-ip-address';

export const createRateLimitMiddleware = (
  limiter: ReturnType<typeof rateLimit>,
  options?: { identifierFn?: (c: Context) => string | undefined },
): MiddlewareHandler => {
  return async (c, next) => {
    let ip: string;
    try {
      ip = getIpAddress(c.req.raw);
    } catch {
      ip = 'unknown';
    }

    const identifier = options?.identifierFn?.(c);

    const result = await limiter.check({ ip, identifier });

    c.header('X-RateLimit-Limit', String(result.limit));
    c.header('X-RateLimit-Remaining', String(result.remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(result.reset.getTime() / 1000)));

    if (result.isLimited) {
      c.header('Retry-After', String(Math.ceil((result.reset.getTime() - Date.now()) / 1000)));
      return c.json({ error: 'Too many requests, please try again later.' }, 429);
    }

    await next();
  };
};
```

### 3.2 Replace existing Hono rate limiters

In `apps/remix/server/router.ts`:

- Remove `hono-rate-limiter` import and both `rateLimiter()` instances
- Replace with `createRateLimitMiddleware()` calls using the defined rate limits
- API routes use IP-only limiting (no identifier)
- AI route uses IP-only limiting with the stricter 3/min limit

```typescript
// Before
import { rateLimiter } from 'hono-rate-limiter';
const rateLimitMiddleware = rateLimiter({ ... });

// After
import { createRateLimitMiddleware } from '@documenso/lib/server-only/rate-limit/rate-limit-middleware';
import { apiV1RateLimit, apiV2RateLimit, aiRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limits';

const apiV1RateLimitMiddleware = createRateLimitMiddleware(apiV1RateLimit);
const apiV2RateLimitMiddleware = createRateLimitMiddleware(apiV2RateLimit);
const aiRateLimitMiddleware = createRateLimitMiddleware(aiRateLimit);
```

### 3.3 Response helpers for inline checks

For auth routes (Hono handlers) and tRPC routes where rate limiting is applied inline rather than via middleware, provide helpers that handle the response formatting and headers consistently.

**Hono helper** — returns a 429 `Response` with headers if limited, or `null` if allowed:

```typescript
export const rateLimitResponse = (c: Context, result: RateLimitCheckResult): Response | null => {
  c.header('X-RateLimit-Limit', String(result.limit));
  c.header('X-RateLimit-Remaining', String(result.remaining));
  c.header('X-RateLimit-Reset', String(Math.ceil(result.reset.getTime() / 1000)));

  if (result.isLimited) {
    c.header('Retry-After', String(Math.ceil((result.reset.getTime() - Date.now()) / 1000)));
    return c.json({ error: 'Too many requests, please try again later.' }, 429);
  }

  return null;
};
```

Usage in auth routes:

```typescript
const result = await loginRateLimit.check({
  ip: requestMetadata.ipAddress ?? 'unknown',
  identifier: input.email,
});

const limited = rateLimitResponse(c, result);
if (limited) return limited;
```

**tRPC helper** — throws a `TRPCError` with rate limit headers if limited:

```typescript
export const assertRateLimit = (result: RateLimitCheckResult): void => {
  if (result.isLimited) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
    });
  }
};
```

Usage in tRPC routes:

```typescript
const result = await request2FAEmailRateLimit.check({
  ip: ctx.requestMetadata.ipAddress ?? 'unknown',
  identifier: input.recipientId,
});

assertRateLimit(result);
```

Both helpers live in `packages/lib/server-only/rate-limit/rate-limit-middleware.ts` alongside the Hono middleware.

### 3.4 Auth endpoint rate limiting

In `packages/auth/server/routes/email-password.ts`, add rate limit checks at the start of each handler using the `rateLimitResponse` helper.

Apply to each endpoint per the tier list:

| Endpoint                    | Rate Limit                                            |
| --------------------------- | ----------------------------------------------------- |
| `POST /signup`              | `signupRateLimit` with `identifier: email`            |
| `POST /authorize` (login)   | `loginRateLimit` with `identifier: email`             |
| `POST /forgot-password`     | `forgotPasswordRateLimit` with `identifier: email`    |
| `POST /resend-verify-email` | `resendVerifyEmailRateLimit` with `identifier: email` |
| `POST /verify-email`        | `verifyEmailRateLimit` with `identifier: token`       |
| `POST /reset-password`      | `resetPasswordRateLimit` with `identifier: token`     |
| `POST /passkey/authorize`   | `passkeyRateLimit` (IP only, no identifier)           |
| `POST /oauth/authorize/*`   | `oauthRateLimit` (IP only)                            |

### 3.4 tRPC unauthenticated route rate limiting

For unauthenticated tRPC routes that send emails, add rate limit checks at the start of the route handler:

| Route                                                      | Rate Limit                           | Identifier             |
| ---------------------------------------------------------- | ------------------------------------ | ---------------------- |
| `document.accessAuth.request2FAEmail`                      | `request2FAEmailRateLimit`           | `recipientId` or token |
| `enterprise.organisation.authenticationPortal.linkAccount` | `linkOrgAccountRateLimit`            | email                  |
| `template.createDocumentFromDirectTemplate`                | Dedicated direct template rate limit | IP only                |

Access `requestMetadata` from the tRPC context (`ctx.requestMetadata.ipAddress`).

### 3.5 tRPC and file routes — general API rate limiting

Add rate limit middleware for currently unprotected routes:

- `/api/trpc/*` — apply `apiTrpcRateLimit` middleware
- `/api/files/*` — apply `fileUploadRateLimit` middleware

---

## 4. Cleanup Job

### 4.1 Job definition

Create `packages/lib/jobs/definitions/internal/cleanup-rate-limits.ts`:

```typescript
export const CLEANUP_RATE_LIMITS_JOB_DEFINITION = {
  id: 'internal.cleanup-rate-limits',
  name: 'Cleanup Rate Limits',
  version: '1.0.0',
  trigger: {
    name: 'internal.cleanup-rate-limits',
    schema: z.object({}),
    cron: '*/15 * * * *', // Every 15 minutes
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./cleanup-rate-limits.handler');
    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<...>;
```

### 4.2 Job handler

Create `packages/lib/jobs/definitions/internal/cleanup-rate-limits.handler.ts`:

- Delete all `RateLimit` rows where `createdAt` is older than 24 hours (covers all possible windows with margin)
- Use batched deletes to avoid long-running transactions
- Batch in chunks of 10,000 rows

```typescript
export const run = async () => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  let deleted = 0;
  do {
    // Prisma doesn't support DELETE with LIMIT, so use raw SQL for batching
    deleted = await prisma.$executeRaw`
      DELETE FROM "RateLimit"
      WHERE "createdAt" < ${cutoff}
      AND ctid IN (
        SELECT ctid FROM "RateLimit"
        WHERE "createdAt" < ${cutoff}
        LIMIT 10000
      )
    `;
  } while (deleted > 0);
};
```

### 4.3 Register in job client

Add `CLEANUP_RATE_LIMITS_JOB_DEFINITION` to the job registry in `packages/lib/jobs/client.ts`.

---

## 5. Remove hono-rate-limiter Dependency

After the migration is complete:

- Remove `hono-rate-limiter` from `apps/remix/package.json`
- Run `npm install` to clean up

---

## 6. Files to Create or Modify

### New Files

| File                                                                    | Purpose                                                                                                         |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `packages/lib/server-only/rate-limit/rate-limit.ts`                     | Core rate limit factory (`rateLimit()`) with window parsing, bucket computation, Prisma upsert, fail-open       |
| `packages/lib/server-only/rate-limit/rate-limits.ts`                    | All rate limit instances (auth, API, AI, file upload)                                                           |
| `packages/lib/server-only/rate-limit/rate-limit-middleware.ts`          | Hono middleware factory, `rateLimitResponse` helper for Hono handlers, `assertRateLimit` helper for tRPC routes |
| `packages/lib/jobs/definitions/internal/cleanup-rate-limits.ts`         | Cleanup cron job definition                                                                                     |
| `packages/lib/jobs/definitions/internal/cleanup-rate-limits.handler.ts` | Cleanup handler (batched deletes)                                                                               |

### Modified Files

| File                                                                    | Change                                                                                                      |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `packages/prisma/schema.prisma`                                         | Add `RateLimit` model                                                                                       |
| `apps/remix/server/router.ts`                                           | Replace `hono-rate-limiter` with DB-backed middleware, add rate limits for `/api/trpc/*` and `/api/files/*` |
| `apps/remix/package.json`                                               | Remove `hono-rate-limiter` dependency                                                                       |
| `packages/auth/server/routes/email-password.ts`                         | Add rate limit checks to signup, login, forgot-password, resend-verify-email, verify-email, reset-password  |
| `packages/auth/server/routes/passkey.ts`                                | Add rate limit check to passkey authorize                                                                   |
| `packages/auth/server/routes/oauth.ts`                                  | Add rate limit check to OAuth authorize endpoints                                                           |
| `packages/trpc/server/document-router/access-auth-request-2fa-email.ts` | Add rate limit check (sends email, unauthenticated)                                                         |
| `packages/trpc/server/enterprise-router/link-organisation-account.ts`   | Add rate limit check (sends email, unauthenticated)                                                         |
| `packages/lib/jobs/client.ts`                                           | Register cleanup-rate-limits job definition                                                                 |

---

## 7. Considerations

### 7.1 Fail-open

All rate limit checks must be wrapped in try/catch. On any DB error, log the error and allow the request through. Rate limiting should never block legitimate traffic due to infrastructure issues.

### 7.2 Performance

- Each API request adds 1 upsert query (~1ms)
- Auth requests add 2 upsert queries (~2ms total)
- The composite primary key ensures all lookups and upserts are index-only operations
- No `COUNT(*)` queries — the count is stored directly in the row

### 7.3 Monitoring

Log rate limit hits at `warn` level with the action, key type (IP/identifier), and count. This provides visibility into traffic patterns and helps tune limits.

### 7.4 Testing

The rate limit module should be mockable in tests. Consider exporting the bucket computation and window parsing as standalone functions for unit testing. Integration tests can verify the upsert + count logic against a test database.

### 7.5 Future improvements

- **Redis backend**: if DB pressure from rate limiting becomes measurable, swap the Prisma upsert for Redis `INCR` + `EXPIRE` with no API changes
- **System-wide circuit breaker**: add a `systemMax` config option that counts all requests for an action regardless of key
