---
date: 2026-03-07
title: Search Query Optimization
---

## Problem

The `searchDocumentsWithKeyword` and `searchTemplatesWithKeyword` functions generate a single massive Prisma `findMany` with 7 OR branches. This produces a SQL query that:

- Joins `Team` twice (aliased j3 and j8) for the two team-access branches
- Embeds 4-level deep EXISTS subqueries (`TeamGroup -> OrganisationGroup -> OrganisationGroupMember -> OrganisationMember`) for each team branch
- Uses `ILIKE` across multiple columns with no way for Postgres to use indexes effectively across the OR
- Includes `recipients: true` on the result even though only a small subset of fields are needed
- Fetches all matching rows then filters visibility **in application code**

With 1,000 documents seeded under `medium-account@documenso.com`, this query is noticeably slow.

---

## Option A: Pre-resolve team IDs, keep Prisma

**Change:** Before the envelope query, resolve the user's accessible team IDs in a single query:

```ts
const teamIds = await prisma.teamGroup
  .findMany({
    where: {
      organisationGroup: {
        organisationGroupMembers: {
          some: { organisationMember: { userId } },
        },
      },
    },
    select: { teamId: true },
  })
  .then((rows) => [...new Set(rows.map((r) => r.teamId))]);
```

Then replace `team: buildTeamWhereQuery(...)` with `teamId: { in: teamIds }` in the envelope query.

**Benefits:**

- Eliminates the duplicated 4-level deep join chain from the envelope query
- The team ID resolution is a simple indexed lookup (runs once, not twice)
- Minimal code change -- still Prisma, same structure
- Can also pre-resolve team roles to move visibility filtering into the WHERE clause

**Drawbacks:**

- Still a single large OR query with ILIKE branches
- Prisma still generates suboptimal SQL for the remaining OR conditions

---

## Option B: Kysely rewrite with pre-resolved teams

**Change:** Rewrite using Kysely (already set up in codebase as `kyselyPrisma.$kysely`). Follow the pattern in `find-envelopes.ts` -- use Kysely for filtering/ID fetching, then Prisma for hydration.

Structure as a UNION of targeted queries instead of a single OR:

```
Query 1: owned docs matching title/externalId (simple indexed lookup)
Query 2: docs where user is recipient matching title (EXISTS on Recipient)
Query 3: team docs matching title/externalId (using pre-resolved teamIds)
UNION ALL -> deduplicate -> ORDER BY createdAt DESC -> LIMIT 20
```

Then hydrate the 20 IDs with Prisma for the include data.

**Benefits:**

- Each sub-query is simple and independently optimizable by Postgres
- UNION eliminates the massive OR which forces bad query plans
- Kysely gives control over exact SQL structure
- Only hydrate the final 20 results (not all matches)
- Follows existing `find-envelopes.ts` pattern -- not a new paradigm

**Drawbacks:**

- More code than Option A
- Two query layers (Kysely for IDs, Prisma for hydration)

---

## Option C: Hybrid -- pre-resolve teams + simplify Prisma OR

**Change:** Pre-resolve team IDs (like Option A), but also restructure the Prisma query to reduce OR branches:

- Merge "owned + title" and "owned + externalId" and "owned + recipient email" into a single owned-docs branch with nested OR
- Merge "team + title" and "team + externalId" into a single team-docs branch
- Keep "recipient inbox" branches separate

This reduces from 7 OR branches to ~3-4, with simpler conditions in each.

**Benefits:**

- Simpler than Kysely rewrite
- Fewer OR branches = better query plan
- Pre-resolved team IDs eliminate the deep joins
- Still pure Prisma

**Drawbacks:**

- Postgres still has to handle OR across different access patterns in one query
- Less control over SQL than Kysely

---

## Recommendation

**Option B (Kysely)** is the strongest choice. The codebase already uses this exact pattern for `find-envelopes.ts` which solves the same class of problem. The UNION approach gives Postgres the best chance at using indexes per sub-query. Pre-resolving team IDs is a prerequisite for all options and is trivially cheap.

The template search query has the same structure and should get the same treatment.
