---
date: 2026-05-29
title: Team Analytics Dashboard
---

> Source: issue #242 (documenso/backlog-internal, "Team signing analytics/dashboard"). Redo of stale PR #1976 (`feat/team-dashboard`, closed DIRTY) — build fresh on `main`; do NOT resurrect that branch or its parallel `analytics/` module. Scope locked via interview 2026-05-29.

## V1 decisions (locked)

| Topic | Decision |
|---|---|
| Goal | Team **document usage** dashboard. NOT signature / recipient / user metrics; no "cumulative active users". |
| Headline | **Documents Sent** (non-draft) + **Completed**. Raw counts only — no completion-rate or derived metrics, no period-over-period deltas. |
| State tiles | Draft · Pending · Completed · **Declined (= `REJECTED`)**. "Voided" dropped (no `VOIDED` status exists). Render as a **row of compact stat tiles** (big number + small label). |
| Attribution | By document **owner** (`Envelope.userId`, reuse `senderIds`). Full per-member, **no** privacy guardrail. |
| Member control | **Filter only** — multiselect of team members + easy "All"; every number reflects the selected subset. Reuse `documents-table-sender-filter`. |
| Time filter | **Calendar presets** (This week / This month / This quarter / This year, Last month, …). Default **This month / last 30 days**. **No per-bucket breakdown, no trend chart** — one total per metric for the range. Boundaries in the **viewer's local timezone**. |
| Folder scope | Aggregate **all folders**. Folder filter control → V2. |
| Counts | **Exact** — drop `STATS_COUNT_CAP` on the analytics path. |
| Freshness | **Live** on every load (no cache in V1). |
| Number format | Full, thousands-separated (`1,234`). |
| Inbox | **Excluded** — dashboard = docs the team PRODUCES, not receives. |
| Placement | Standalone top-level route `/t/:teamUrl/analytics` + **primary nav entry**. |
| Access | `ADMIN` + `MANAGER` only. `MEMBER` → **hide nav + silent redirect** to documents (no 403, no existence leak). |
| Rollout | Behind a **feature flag**, then open to all teams. No plan/tier gating. |
| Empty state | Friendly empty state with CTA to send the first document. |
| Export | Out of V1 (gold-plating). |
| Deferred → V2 | Folder filter, personal/individual analytics, org-wide cross-team rollup, trend charts, period deltas, derived metrics. |

## Metric semantics — READ THIS

**Event model, bucketed by status date.** Each number counts documents that ENTERED that state during the selected period, each on its OWN date axis:

- **Documents Sent** = non-draft, `createdAt` ∈ period. *(createdAt is the sent-date proxy — see Risks.)*
- **Pending** = currently `PENDING`, `createdAt` ∈ period (sent in period, still pending).
- **Completed** = status `COMPLETED`, **`Envelope.completedAt`** ∈ period.
- **Declined** = status `REJECTED`, rejection time ∈ period — sourced from **`DocumentAuditLog` `DOCUMENT_RECIPIENT_REJECTED`** (there is no `Envelope.rejectedAt`).
- **Draft** = currently `DRAFT`, `createdAt` ∈ period (informational; excluded from "Sent").

⚠️ **Tiles are independent activity counts on different date axes → they do NOT sum to "Documents Sent."** A doc sent in April but completed in May lands in May's Completed, not April's. The UI must NOT present the tiles as if they add up to the headline (no "x of y" framing, no stacked-total visuals).

## Backend

- **New dedicated analytics query** (e.g. `packages/lib/server-only/team/get-team-analytics.ts`). **Do NOT call `getStats` directly** — its semantics diverge (root-folder-only, `STATS_COUNT_CAP`-capped, every status bucketed by `createdAt`). **Reuse its *patterns*:** Kysely builder, team `visibilityFilter` / `teamDeletedFilter`, `senderIds`, `EnvelopeType.DOCUMENT`, `deletedAt IS NULL`.
- Per-metric windows: `createdAt` for Sent/Pending/Draft; `Envelope.completedAt` for Completed; join `DocumentAuditLog` (`type = DOCUMENT_RECIPIENT_REJECTED`, by `envelopeId`, earliest timestamp) for Declined. Exact `COUNT(*)` — no cap.
- Period: resolve `[start, end)` from preset + **viewer timezone** (client sends IANA zone/offset; default UTC if absent). Use Luxon (already imported in `get-stats.ts`).
- tRPC: new `team.getAnalytics` (team-router per-file pattern, `packages/trpc/server/team-router/`). Input `{ teamId, period | { from, to }, senderIds[] }`. **Gate `ADMIN`/`MANAGER`** via team role (`getTeamById` → `currentTeamRole`); deny `MEMBER`.

## Frontend

- Route `apps/remix/app/routes/_authenticated+/t.$teamUrl+/analytics._index.tsx`. Loader resolves team + role; `MEMBER` → `redirect` to `/t/:teamUrl/documents`. Behind feature flag (hidden + redirect when off).
- Components (tight, glanceable): headline (Documents Sent, Completed) + compact tile row (Draft/Pending/Completed/Declined); member multiselect (reuse `documents-table-sender-filter`, "All"); calendar-preset period selector; empty state.
- Nav entry in `apps/remix/app/components/general/menu-switcher.tsx`, gated by role + flag.

## Design

1. **Match existing Documenso UI** — Shadcn + Tailwind cards/typography from documents index & admin stats; reuse primitives, don't invent.
2. **Consult the `uidotsh` (`/ui`) skill for EVERY design decision.** No layout/spacing/component/visual choice ships without first fetching `uidotsh://ui`, routing to the matching subskill, and loading its design-guideline files before writing markup. Subskills: `ideas` (tile-row layout options), `design` (`design-guidelines.md`), `finalize` = `componentize` + `canonicalize-tailwind`, `add-dark-mode`, `make-responsive`.

## Approach order

Per ElTimuro: **iterate on the UI first, then finalize the backend.** Stand up the page + filters against a thin query, agree the tile layout via `uidotsh`, then lock the analytics query (date axes, audit-log join, exact counts).

## Verification

- Unit (`get-team-analytics`): doc sent-April/completed-May counts in May's Completed only (not April); Declined dated from audit log; all-folders aggregation; exact counts beyond the old cap; `senderIds` attribution; timezone-correct period boundaries.
- Unit (route/router): `ADMIN`/`MANAGER` allowed, `MEMBER` denied/redirected; flag off → nav hidden + redirect.
- E2E (Playwright, `@documenso/app-tests`): admin sees dashboard; member redirected away; member-filter and period-preset changes move the numbers; new team shows empty state.

## Risks / open

1. **Sent-date proxy:** `createdAt` ≠ true send time for draft-then-sent docs. More accurate = `DocumentAuditLog DOCUMENT_SENT`. V1 uses `createdAt` (no extra join); revisit if attribution looks wrong.
2. **Audit-log join cost** for Declined on large teams (live + uncapped). Acceptable for V1; caching/precompute is the V2 lever if it bites.
3. **Non-summing tiles** can confuse stakeholders — needs clear labels/tooltip; confirm framing with ElTimuro on the UI pass.
4. **Timezone plumbing:** client must send its zone and the server must bucket in it. Confirm no existing team-timezone setting should take precedence.
