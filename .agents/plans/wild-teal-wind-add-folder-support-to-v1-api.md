---
date: 2026-02-10
title: Add Folder Support To V1 Api
status: ready
---

## Problem

The `GET /api/v1/documents` endpoint does not return documents inside folders. The underlying `findDocuments()` function defaults to `folderId: null` when no `folderId` is provided, meaning only root-level documents are returned. The V1 API never passes `folderId`, so folder documents are invisible to API consumers.

Additionally, neither the list endpoint nor the single-document endpoint exposes `folderId` in the response, so consumers cannot know which folder a document belongs to.

## Root Cause

In `packages/lib/server-only/document/find-documents.ts` (line 222-226):

```ts
if (folderId !== undefined) {
  whereClause.folderId = folderId;
} else {
  whereClause.folderId = null; // Only root documents returned
}
```

The V1 `getDocuments` handler in `packages/api/v1/implementation.ts` (line 61-70) only passes `page` and `perPage` to `findDocuments` — it never extracts or forwards a `folderId` from the query string.

## Decisions

These decisions were made during the spec interview:

1. **Fix V1 directly** — The V1 API is deprecated but still actively used. This is a quick, low-risk fix. No need to defer to a newer API.
2. **Breaking change accepted** — Returning ALL documents by default (instead of root-only) is intentional. The current root-only behavior is a bug, not a feature.
3. **No root-only query option needed** — Not all documents are in folders, so consumers can filter client-side using the `folderId` field in the response if needed.
4. **No folder existence validation** — `?folderId=nonexistent` returns empty array, not 404. Consistent with V1 list endpoint patterns.
5. **Add `folderId` to both endpoints** — Both `GET /api/v1/documents` (list) and `GET /api/v1/documents/:id` (single) will include `folderId` in the response.
6. **Top-level `skipFolderFilter` is sufficient** — The inner helper filters (`findDocumentsFilter`, `findTeamDocumentsFilter`) receive `folderId: undefined` when skip is active. Prisma ignores `undefined` values in WHERE clauses, so these inner filters will not constrain by folder. No propagation needed.
7. **Scope is minimal** — Only `folderId` support. No other filters (status, period, query, senderIds) added in this change.

## Scope

Three files need changes. No new files.

| File                                                  | Change                                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/api/v1/schema.ts`                           | Add `folderId` to query schema + both response schemas                   |
| `packages/api/v1/implementation.ts`                   | Pass `folderId` through in `getDocuments`, add to `getDocument` response |
| `packages/lib/server-only/document/find-documents.ts` | Add `skipFolderFilter` option                                            |

## Changes

### 1. `packages/api/v1/schema.ts` — Add `folderId` to query + response schemas

**Query schema** (`ZGetDocumentsQuerySchema`, line 35-38):

```ts
export const ZGetDocumentsQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  perPage: z.coerce.number().min(1).optional().default(10),
  folderId: z
    .string()
    .describe(
      'Filter documents by folder ID. When omitted, returns all documents regardless of folder.',
    )
    .optional(),
});
```

**List response schema** (`ZSuccessfulDocumentResponseSchema`, line 46-56):

Add `folderId: z.string().nullish()` so consumers can see which folder each document belongs to.

**Single document response schema** (`ZSuccessfulGetDocumentResponseSchema`, line 58-79):

Add `folderId: z.string().nullish()` to the extended schema as well.

### 2. `packages/api/v1/implementation.ts` — Pass `folderId` through + add to responses

**`getDocuments` handler** (line 61-70):

```ts
getDocuments: authenticatedMiddleware(async (args, user, team) => {
  const page = Number(args.query.page) || 1;
  const perPage = Number(args.query.perPage) || 10;

  const { data: documents, totalPages } = await findDocuments({
    page,
    perPage,
    userId: user.id,
    teamId: team.id,
    folderId: args.query.folderId,
    skipFolderFilter: args.query.folderId === undefined,
  });

  return {
    status: 200,
    body: {
      documents: documents.map((document) => ({
        id: mapSecondaryIdToDocumentId(document.secondaryId),
        externalId: document.externalId,
        userId: document.userId,
        teamId: document.teamId,
        folderId: document.folderId,
        title: document.title,
        status: document.status,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
        completedAt: document.completedAt,
      })),
      totalPages,
    },
  };
}),
```

**`getDocument` handler** (line 91-197):

Add `folderId: envelope.folderId` to the response body mapping (alongside `id`, `externalId`, etc.).

### 3. `packages/lib/server-only/document/find-documents.ts` — Handle "return all" semantics

Add `skipFolderFilter` to the options type and modify the WHERE clause logic:

```ts
export type FindDocumentsOptions = {
  // ... existing fields ...
  folderId?: string;
  skipFolderFilter?: boolean;
};
```

Modify the folderId logic (line 222-226):

```ts
if (!skipFolderFilter) {
  if (folderId !== undefined) {
    whereClause.folderId = folderId;
  } else {
    whereClause.folderId = null;
  }
}
```

When `skipFolderFilter` is true:

- The top-level `whereClause.folderId` is never set — no folder constraint at the top level.
- The inner helpers (`findDocumentsFilter`, `findTeamDocumentsFilter`) receive `folderId: undefined`, which Prisma ignores in WHERE objects — no folder constraint at the inner level either.
- Result: all documents returned regardless of folder.

When `skipFolderFilter` is false (default, used by UI/tRPC callers):

- Existing behavior is completely unchanged. `folderId: undefined` still defaults to root-only.

## Why `skipFolderFilter` (Option B)

Two approaches were considered:

**Option A: Change `folderId: undefined` semantics to mean "all documents"**

- Risky: would affect all callers of `findDocuments` (UI, tRPC) unless every caller is audited.
- The UI intentionally shows root-only when no folder is selected.

**Option B (chosen): Add `skipFolderFilter` boolean**

- Additive — no existing callers pass this flag, so they're unaffected.
- Explicit — the intent is clear in the code.
- Safe — zero risk to UI/tRPC behavior.

## Behavior Matrix

| Request                                      | Current Behavior    | New Behavior              |
| -------------------------------------------- | ------------------- | ------------------------- |
| `GET /api/v1/documents`                      | Root docs only      | ALL docs (root + folders) |
| `GET /api/v1/documents?folderId=abc`         | Not supported       | Docs in folder `abc` only |
| `GET /api/v1/documents?folderId=nonexistent` | Not supported       | Empty array, 200 OK       |
| `GET /api/v1/documents/:id` response         | No `folderId` field | Includes `folderId`       |

## Implementation Notes

- `folderId` is a `String?` on the `Envelope` model in Prisma, not a number.
- The `findDocuments` function already accepts `folderId` in its options type — it just needs the `skipFolderFilter` escape hatch.
- No need to propagate `skipFolderFilter` into `findDocumentsFilter` or `findTeamDocumentsFilter`. When `folderId` is `undefined`, those helpers embed `folderId: undefined` in their Prisma WHERE objects. Prisma strips `undefined` keys, so no folder constraint is applied. This is well-documented Prisma behavior.
- The `createDocument` endpoint already supports `folderId` in the request body (line 139-144 of schema.ts), confirming the pattern.
- The `getDocument` handler fetches from `prisma.envelope.findFirstOrThrow` which already includes `folderId` on the envelope — just needs to be added to the response mapping.

## Testing

Manual and automated test cases:

1. `GET /api/v1/documents` returns docs from root AND subfolders.
2. `GET /api/v1/documents?folderId=<valid-id>` returns only docs in that folder.
3. `GET /api/v1/documents?folderId=<nonexistent-id>` returns empty array with 200 status.
4. List response includes `folderId` field on each document (null for root docs, string for folder docs).
5. `GET /api/v1/documents/:id` response includes `folderId` field.
6. Existing UI/tRPC callers of `findDocuments` are unaffected (they don't pass `skipFolderFilter`).
7. Pagination: verify `totalPages` correctly reflects the larger result set when all docs are returned.

## Breaking Change Notice

This is a **breaking change** for existing V1 API consumers:

- **Before**: `GET /api/v1/documents` returned only root-level documents (those not in any folder).
- **After**: `GET /api/v1/documents` returns all documents regardless of folder placement.

Impact:

- Consumers paginating through results will see more documents in the total count.
- Consumers building UIs will now display folder documents they previously didn't see.
- The new `folderId` field is additive and won't break existing response parsing.

This is considered a **bug fix**, not a feature removal. The previous behavior silently hid documents from API consumers.
