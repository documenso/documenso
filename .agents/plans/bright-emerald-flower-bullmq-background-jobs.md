---
date: 2026-03-26
title: Bullmq Background Jobs
---

## Context

The codebase has a well-designed background job provider abstraction (`BaseJobProvider`) with two existing implementations:

- **InngestJobProvider** — cloud/SaaS provider, externally hosted
- **LocalJobProvider** — database-backed (Postgres via Prisma), uses HTTP self-calls to dispatch

The goal is to add a third provider backed by a proper job queue library for self-hosted deployments that need more reliability than the Local provider offers.

### Current Architecture

All code lives in `packages/lib/jobs/`:

- `client/base.ts` — Abstract `BaseJobProvider` with 4 methods: `defineJob()`, `triggerJob()`, `getApiHandler()`, `startCron()`
- `client/client.ts` — `JobClient` facade, selects provider via `NEXT_PRIVATE_JOBS_PROVIDER` env var
- `client/inngest.ts` — Inngest implementation
- `client/local.ts` — Local/Postgres implementation
- `client/_internal/job.ts` — Core types: `JobDefinition`, `JobRunIO`, `SimpleTriggerJobOptions`
- `definitions/` — 19 job definitions (15 event-triggered, 4 cron)

The `JobRunIO` interface provided to handlers includes:

- `runTask(cacheKey, callback)` — idempotent task execution (cached via `BackgroundJobTask` table)
- `triggerJob(cacheKey, options)` — chain jobs from within handlers
- `wait(cacheKey, ms)` — delay/sleep (not implemented in Local provider)
- `logger` — structured logging

### Local Provider Limitations

The current Local provider has several issues that motivate this work:

1. `io.wait()` throws "Not implemented"
2. HTTP self-call with 150ms fire-and-forget `Promise.race` is fragile
3. No concurrency control — jobs run in the web server process
4. No real retry backoff (immediate re-dispatch)
5. No monitoring/visibility into job status
6. Jobs compete for resources with HTTP request handling

---

## Provider Evaluation

Three alternatives were evaluated against the existing provider interface and project requirements.

### BullMQ (Redis-backed) — Recommended

| Attribute           | Detail                     |
| ------------------- | -------------------------- |
| Backend             | Redis 7.x                  |
| npm downloads/month | ~15M                       |
| TypeScript          | Native                     |
| Delayed jobs        | Yes (ms precision)         |
| Cron/repeatable     | Yes (`upsertJobScheduler`) |
| Retries + backoff   | Yes (exponential, custom)  |
| Concurrency control | Yes (per-worker)           |
| Rate limiting       | Yes (per-queue, per-group) |
| Dashboard           | Bull Board (mature)        |
| New infrastructure  | Yes — Redis required       |

**Why BullMQ**: Most mature and widely-adopted Node.js queue. Native delayed jobs solve the `io.wait()` gap. Redis is purpose-built for queue workloads and keeps Postgres clean for application data. Bull Board gives immediate operational visibility. The provider abstraction already exists so wrapping BullMQ is straightforward.

**Trade-off**: Requires Redis, which is additional infrastructure. However, Redis is a single Docker Compose service or a free Upstash tier, and the operational benefit is significant.

### pg-boss (PostgreSQL-backed) — Strong Alternative

| Attribute           | Detail                        |
| ------------------- | ----------------------------- |
| Backend             | PostgreSQL (existing)         |
| npm downloads/month | ~1.4M                         |
| TypeScript          | Native                        |
| Delayed jobs        | Yes (`startAfter`)            |
| Cron/repeatable     | Yes (`schedule()`)            |
| New infrastructure  | No — reuses existing Postgres |

**Why it could work**: Zero new infrastructure since the project already uses Postgres. API maps well to existing patterns.

**Why it's second choice**: Polling-based (no LISTEN/NOTIFY), adds write amplification to the primary database, smaller ecosystem, no dashboard. At scale, queue operations on the primary database become a concern.

### Graphile Worker (PostgreSQL-backed) — Less Suitable

Uses LISTEN/NOTIFY for instant pickup but has a file-based task convention and separate schema that don't mesh well with the existing Prisma-centric architecture. Would require more adapter work.

### Improving the Local Provider — Not Recommended

Fixing the Local provider's issues (wait support, replacing HTTP self-calls, adding concurrency control, backoff) essentially means rebuilding a queue library from scratch with less robustness and no community maintenance.

---

## Recommendation

**Proceed with BullMQ.** It's the most capable option, maps cleanly to the existing provider interface, and is the standard choice for production Node.js applications. Redis is lightweight infrastructure with managed options available at every cloud provider.

**If Redis is a hard blocker**, pg-boss is the clear fallback — but the plan below assumes BullMQ.

---

## Implementation Plan

### Phase 1: BullMQ Provider Core

**File: `packages/lib/jobs/client/bullmq.ts`**

Create `BullMQJobProvider extends BaseJobProvider` with singleton pattern matching the existing providers.

Key implementation details:

1. **Constructor / `getInstance()`**
   - Initialize a Redis `IORedis` connection using new env var: `NEXT_PRIVATE_REDIS_URL`
   - Create a single `Queue` instance for dispatching jobs, using `NEXT_PRIVATE_REDIS_PREFIX` as the BullMQ `prefix` option (defaults to `documenso` if unset). This namespaces all Redis keys so multiple environments (worktrees, branches, developers) sharing the same Redis instance don't collide.
   - Create a single `Worker` instance for processing jobs (in-process, same prefix)
   - Store job definitions in a `_jobDefinitions` record (same pattern as Local provider)

2. **`defineJob()`**
   - Store definition in `_jobDefinitions` keyed by ID
   - If the definition has a `trigger.cron`, register it via `queue.upsertJobScheduler()` with the cron expression

3. **`triggerJob(options)`**
   - Find eligible definitions by `trigger.name` (same lookup as Local provider)
   - For each, call `queue.add(jobDefinitionId, payload)` with appropriate options
   - Support `options.id` for deduplication via BullMQ's `jobId` option

4. **`getApiHandler()`**
   - Return a minimal health-check / queue-status handler. Unlike the Local provider, BullMQ workers don't need an HTTP endpoint to receive jobs — they pull from Redis directly. The API handler can return queue metrics for monitoring.

5. **`startCron()`**
   - No-op — cron is handled by BullMQ's `upsertJobScheduler` registered during `defineJob()`

6. **Worker setup**
   - Single worker processes all job types by dispatching to the correct handler from `_jobDefinitions`
   - Configure concurrency with a default of 10 (overridable via `NEXT_PRIVATE_BULLMQ_CONCURRENCY` env var for those who need to tune it)
   - Configure retry with exponential backoff: `backoff: { type: 'exponential', delay: 1000 }`
   - Default 3 retries (matching current Local provider behavior)

7. **`createJobRunIO(jobId)`** — Implement `JobRunIO`:
   - `runTask()`: Reuse the existing `BackgroundJobTask` Prisma table for idempotent task tracking (same pattern as Local provider)
   - `triggerJob()`: Delegate to `this.triggerJob()`
   - `wait()`: Throw "Not implemented" (same as Local provider). No handler uses `io.wait()` so this has zero impact
   - `logger`: Same console-based logger pattern as Local provider

### Phase 2: Provider Registration

**File: `packages/lib/jobs/client/client.ts`**

Add `'bullmq'` case to the provider match:

```typescript
this._provider = match(env('NEXT_PRIVATE_JOBS_PROVIDER'))
  .with('inngest', () => InngestJobProvider.getInstance())
  .with('bullmq', () => BullMQJobProvider.getInstance())
  .otherwise(() => LocalJobProvider.getInstance());
```

**File: `packages/tsconfig/process-env.d.ts`**

Add `'bullmq'` to the `NEXT_PRIVATE_JOBS_PROVIDER` type union and add Redis env var types:

```typescript
NEXT_PRIVATE_JOBS_PROVIDER?: 'inngest' | 'local' | 'bullmq';
NEXT_PRIVATE_REDIS_URL?: string;
NEXT_PRIVATE_REDIS_PREFIX?: string;
NEXT_PRIVATE_BULLMQ_CONCURRENCY?: string;
```

**File: `.env.example`**

Add Redis configuration examples:

```env
NEXT_PRIVATE_JOBS_PROVIDER="local"  # Options: local, inngest, bullmq
NEXT_PRIVATE_REDIS_URL="redis://localhost:63790"
NEXT_PRIVATE_REDIS_PREFIX="documenso"  # Namespace for Redis keys (useful when sharing a Redis instance)
```

**File: `turbo.json`**

Add `NEXT_PRIVATE_REDIS_URL`, `NEXT_PRIVATE_REDIS_PREFIX`, and `NEXT_PRIVATE_BULLMQ_CONCURRENCY` to the env vars list for cache invalidation.

### Phase 3: Infrastructure & Dependencies

**File: `packages/lib/package.json`**

Add dependencies:

- `bullmq` — the queue library
- `ioredis` — Redis client (peer dependency of BullMQ, but explicit is better)

**File: `docker-compose.yml` (or equivalent)**

Add Redis service for local development:

```yaml
redis:
  image: redis:7-alpine
  ports:
    - '6379:6379'
```

### Phase 4: Optional Enhancements

These are not required for the initial implementation but worth considering for follow-up:

1. **Bull Board integration** — Add a `/api/jobs/dashboard` route that serves Bull Board UI for monitoring. Gate behind an admin auth check.

2. **Separate worker process** — Add an `apps/worker` entry point that runs BullMQ workers without the web server, for deployments that want to isolate job processing from request handling.

3. **Graceful shutdown** — Register `SIGTERM`/`SIGINT` handlers to call `worker.close()` and `queue.close()` for clean shutdown.

4. **BackgroundJob table integration** — Optionally continue writing to the `BackgroundJob` Prisma table for audit/history, using BullMQ events (`completed`, `failed`) to update status. This preserves the existing database-level visibility.

---

## Files to Create/Modify

| File                                 | Action     | Description                              |
| ------------------------------------ | ---------- | ---------------------------------------- |
| `packages/lib/jobs/client/bullmq.ts` | **Create** | BullMQ provider implementation           |
| `packages/lib/jobs/client/client.ts` | Modify     | Add `'bullmq'` provider case             |
| `packages/tsconfig/process-env.d.ts` | Modify     | Add type for `'bullmq'` + Redis env vars |
| `.env.example`                       | Modify     | Add Redis config example                 |
| `turbo.json`                         | Modify     | Add Redis env var to cache keys          |
| `packages/lib/package.json`          | Modify     | Add `bullmq` + `ioredis` dependencies    |
| `docker-compose.yml`                 | Modify     | Add Redis service                        |

---

## Open Questions

1. **Should the BullMQ provider also write to the `BackgroundJob` Prisma table?** This would maintain audit history and allow existing admin tooling to query job status. Trade-off is dual-write complexity.

2. **Redis connection resilience**: Should the provider gracefully degrade if Redis is unavailable (e.g., fall back to Local provider), or fail hard? Failing hard is simpler and more predictable.

## Resolved Questions

- **`io.wait()`**: Not a concern. Only Inngest implements it (via `step.sleep`), the Local provider throws "Not implemented", and no job handler calls `io.wait()`. The BullMQ provider can throw "Not implemented" identically to the Local provider.
