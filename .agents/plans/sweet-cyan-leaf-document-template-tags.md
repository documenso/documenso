---
date: 2026-06-29
title: Document Template Tags
---

## Problem

Users currently organise documents and templates using **folders** (a hierarchical, single-parent structure). There is no way to apply **flat, cross-cutting labels** (tags) to envelopes — e.g. "urgent", "invoice", "contract", "HR". This makes it hard to filter, group, and find documents/templates across folder boundaries.

Tags complement folders: a folder answers "where is this?", a tag answers "what kind is this?". An envelope can be in exactly one folder but should be able to carry many tags.

## Goals

1. Allow users to create, update, and delete tags scoped to their team.
2. Allow users to assign one or more tags to a document or template.
3. Allow users to filter the documents and templates list pages by tag(s).
4. Display tags on document/template table rows and detail pages.
5. Expose tag management and filtering through tRPC routes (and optionally the V1 public API).
6. Follow the existing **folder** feature as the architectural blueprint so the codebase stays consistent.

## Design Decisions

These decisions are informed by the existing `Folder` feature and codebase conventions:

1. **Tags are team-scoped** — Just like `Folder`, every `Tag` belongs to a `teamId` and a `userId` (creator). This matches `buildTeamWhereQuery` access patterns used throughout the lib layer.

2. **Tags are type-specific (DOCUMENT / TEMPLATE)** — Following the `FolderType` enum pattern (`DOCUMENT` / `TEMPLATE`). A `TagType` enum mirrors this so document tags and template tags are managed separately, consistent with how folders are split (`documents.folders._index.tsx` vs `templates.folders._index.tsx`). *Alternative considered: shared tags with no type — rejected for consistency with folders and to keep the UI clean.*

3. **Many-to-many via a join table (`EnvelopeTag`)** — Unlike folders (single `folderId` on `Envelope`), an envelope can have many tags and a tag can be on many envelopes. A join table is required.

4. **Optional `color` field** — A nullable hex color string (`#RRGGBB`) for visual distinction in the UI. Optional so it's not a breaking concern if omitted.

5. **Unique constraint `(teamId, name, type)`** — Prevents duplicate tag names within a team for a given type. Names are case-insensitive-normalised on write.

6. **Filtering semantics: OR (any of)** — When filtering by multiple tags, return envelopes that have **any** of the selected tags. This is the most common tag-filter UX. *Alternative considered: AND (must have all) — noted as a future toggle if needed.*

7. **Assigning tags replaces the full set** — The `setEnvelopeTags` operation takes an array of tag IDs and sets the envelope's tags to exactly that set (add/remove diff). This is simpler and less error-prone than individual add/remove operations and matches how form state typically works.

8. **Inline tag creation during assignment** — The assignment UI allows creating a new tag on-the-fly (autocomplete + create), similar to common tag-input UX. The `setEnvelopeTags` route will accept either an existing `tagId` or a `{ name, color }` to create-and-assign in one step.

9. **`deletedAt` is not needed for tags** — Unlike envelopes, tags are lightweight metadata. Deleting a tag cascades to remove the join-table rows (`onDelete: Cascade`). Envelopes are unaffected.

10. **V1 public API is a separate, optional phase** — Tag CRUD + filtering is added to tRPC first. V1 API endpoints can follow the same pattern used for folders (`packages/api/v1/`) but are deferred to a later phase to keep this change focused.

## Scope

This plan touches four layers: Prisma schema, lib (server-only), tRPC, and the Remix UI. New files are created for the tag lib functions and tag-router; existing files are extended for filtering and display.

| Layer | New files | Modified files |
| ----- | --------- | -------------- |
| Prisma | schema migration | `packages/prisma/schema.prisma` |
| Lib | `packages/lib/server-only/tag/*` (6 files) | `find-documents.ts`, `find-templates.ts` |
| tRPC | `packages/trpc/server/tag-router/*` (2 files), root router registration | `document-router/find-documents.types.ts`, `template-router` find types, root `trpc.ts` |
| UI | tag primitives + filter component | documents/templates list pages, tables, edit pages |
| V1 API (deferred) | — | — |

## Changes

### 1. Database Schema — `packages/prisma/schema.prisma`

Add a `TagType` enum and `Tag` model, plus an `EnvelopeTag` join table:

```prisma
enum TagType {
  DOCUMENT
  TEMPLATE
}

model Tag {
  id        String   @id @default(cuid())
  name      String
  color     String?
  type      TagType
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  teamId    Int
  team      Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  envelopes EnvelopeTag[]
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt

  @@unique([teamId, name, type])
  @@index([teamId])
  @@index([teamId, type])
}

model EnvelopeTag {
  envelopeId String
  envelope   Envelope @relation(fields: [envelopeId], references: [id], onDelete: Cascade)
  tagId      String
  tag        Tag      @relation(fields: [tagId], references: [id], onDelete: Cascade)
  assignedBy Int
  assignedByUser User @relation(fields: [assignedBy], references: [id], onDelete: Cascade)
  assignedAt DateTime @default(now())

  @@id([envelopeId, tagId])
  @@index([tagId])
}
```

Add the back-relations to `Envelope` and `User` and `Team`:

```prisma
// On Envelope model, add:
tags EnvelopeTag[]

// On User model, add:
tags       Tag[]
envelopeTags EnvelopeTag[]

// On Team model, add:
tags Tag[]
```

**Migration:** Run `npx prisma migrate dev --name add_document_template_tags` (or the project's equivalent migration command). The migration creates both tables, indexes, and the unique constraint.

### 2. Lib Layer — `packages/lib/server-only/tag/`

Create a new `tag/` directory mirroring the `folder/` directory structure. Each file follows the existing pattern: import `prisma`, use `AppError`/`AppErrorCode`, use `buildTeamWhereQuery` for team access, and `getTeamById` / `getMemberRoles` for role-based visibility.

#### `create-tag.ts`
```ts
export interface CreateTagOptions {
  userId: number;
  teamId: number;
  name: string;
  color?: string;
  type: TTagType; // DOCUMENT | TEMPLATE
}
```
- Validates team access via `getTeamSettings`.
- Normalises `name` (trim, collapse whitespace).
- Throws `AppError(AppErrorCode.CONFLICT)` on duplicate `(teamId, name, type)` (caught from Prisma unique violation or pre-checked).
- Returns the created `Tag`.

#### `find-tags.ts`
```ts
export interface FindTagsOptions {
  userId: number;
  teamId: number;
  type?: TTagType;
  query?: string;
  page?: number;
  perPage?: number;
}
```
- Paginated list of tags for a team, optionally filtered by type and a name search query.
- Uses `buildTeamWhereQuery` for access control.
- Returns `FindResultResponse<Tag>`.

#### `update-tag.ts`
```ts
export interface UpdateTagOptions {
  userId: number;
  teamId: number;
  tagId: string;
  data: { name?: string; color?: string | null };
}
```
- Verifies tag belongs to the user's team.
- Updates name and/or color.
- Re-validates uniqueness if name changes.

#### `delete-tag.ts`
```ts
export interface DeleteTagOptions {
  userId: number;
  teamId: number;
  tagId: string;
}
```
- Verifies ownership/team access.
- `prisma.tag.delete` — cascades to `EnvelopeTag` rows automatically.

#### `set-envelope-tags.ts`
```ts
export interface SetEnvelopeTagsOptions {
  userId: number;
  teamId: number;
  envelopeId: string;
  tagIds: string[];
}
```
- Fetches the envelope, verifies access (team + visibility, same checks as folder operations).
- Verifies all `tagIds` belong to the same team and match the envelope's type (DOCUMENT tags for documents, TEMPLATE tags for templates).
- Uses a Prisma transaction to diff: delete `EnvelopeTag` rows not in the new set, insert missing ones.
- Returns the updated list of tags on the envelope.

#### `get-envelope-tags.ts`
```ts
export interface GetEnvelopeTagsOptions {
  userId: number;
  teamId: number;
  envelopeId: string;
}
```
- Returns all tags assigned to an envelope (with access check).

#### `types/tag-type.ts` — `packages/lib/types/tag-type.ts`
```ts
import { z } from 'zod';
export const ZTagTypeSchema = z.enum(['DOCUMENT', 'TEMPLATE']);
export type TTagType = z.infer<typeof ZTagTypeSchema>;
```
(Mirrors `packages/lib/types/folder-type.ts`.)

### 3. Filtering — Modify `find-documents.ts` and `find-templates.ts`

#### `find-documents.ts` (Kysely-based)
- Add `tagIds?: string[]` to `FindDocumentsOptions`.
- When `tagIds` is non-empty, add an `EXISTS` subquery to the WHERE clause:
  ```ts
  eb.exists(
    eb.selectFrom('EnvelopeTag')
      .whereRef('EnvelopeTag.envelopeId', '=', 'Envelope.id')
      .where('EnvelopeTag.tagId', 'in', sql.join(tagIds.map(sql.lit)))
      .select(sql.lit(1).as('one'))
  )
  ```
  This implements **OR (any of)** semantics — the envelope matches if it has at least one of the selected tags.
- Hydration step (`prisma.envelope.findMany`) should `include: { tags: { include: { tag: true } } }` so tags are returned with each document.

#### `find-templates.ts` (Prisma-based)
- Add `tagIds?: string[]` to `FindTemplatesOptions`.
- Add to the `where` clause:
  ```ts
  tagIds?.length ? { tags: { some: { tagId: { in: tagIds } } } } : undefined
  ```
- Add `tags: { include: { tag: true } }` to `templateInclude`.

### 4. tRPC Layer — `packages/trpc/server/tag-router/`

Create `tag-router/router.ts` and `tag-router/schema.ts`, mirroring `folder-router/`.

#### `tag-router/schema.ts`
```ts
import TagSchema from '@documenso/prisma/generated/zod/modelSchema/TagSchema';
import { ZTagTypeSchema } from '@documenso/lib/types/tag-type';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';

export const ZTagSchema = TagSchema.pick({
  id: true, name: true, color: true, type: true,
  teamId: true, userId: true, createdAt: true, updatedAt: true,
});

export const ZCreateTagRequestSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  type: ZTagTypeSchema,
});

export const ZCreateTagResponseSchema = ZTagSchema;

export const ZUpdateTagRequestSchema = z.object({
  tagId: z.string(),
  data: z.object({
    name: z.string().min(1).max(50).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  }),
});

export const ZDeleteTagRequestSchema = z.object({ tagId: z.string() });

export const ZFindTagsRequestSchema = ZFindSearchParamsSchema.extend({
  type: ZTagTypeSchema.optional(),
  query: z.string().optional(),
});

export const ZFindTagsResponseSchema = ZFindResultResponse.extend({
  data: z.array(ZTagSchema),
});

export const ZSetEnvelopeTagsRequestSchema = z.object({
  envelopeId: z.string(),
  tagIds: z.array(z.string()),
});

export const ZSetEnvelopeTagsResponseSchema = z.array(ZTagSchema);
```

#### `tag-router/router.ts`
Routes following the folder-router conventions (`authenticatedProcedure`, OpenAPI meta with `tags: ['Tag']`, GET/POST only):

| Route name | Method | Path | Description |
| ---------- | ------ | ---- | ----------- |
| `findTags` | GET | `/tag` | Find tags for the current team |
| `createTag` | POST | `/tag/create` | Create a new tag |
| `updateTag` | POST | `/tag/update` | Update a tag's name/color |
| `deleteTag` | POST | `/tag/delete` | Delete a tag (cascades to assignments) |
| `setEnvelopeTags` | POST | `/tag/assign` | Set the full tag set on an envelope |

Each route deconstructs `input` on its own line, uses `ctx.teamId` and `ctx.user.id`, and logs via `ctx.logger.info`.

#### Register the router
In the root tRPC router file (where `folderRouter` is registered), add:
```ts
import { tagRouter } from './tag-router/router';
// ...
tag: tagRouter,
```

#### Update find-documents / find-templates request schemas
- `document-router/find-documents.types.ts`: add `tagIds: z.array(z.string()).optional()` to `ZFindDocumentsRequestSchema`.
- `template-router` find types: add `tagIds: z.array(z.string()).optional()`.
- `document-router/find-documents-internal.types.ts`: add `tagIds` so the UI can filter.

### 5. UI Layer — Remix app

#### New primitives (`packages/ui/primitives/tag/`)
- `tag-badge.tsx` — a small coloured pill displaying a tag name (uses `color` if present, falls back to a default Tailwind colour).
- `tag-input.tsx` — an autocomplete multi-select tag input with inline creation (used in edit pages and dialogs). Renders existing tags as removable badges; typing filters suggestions; pressing Enter or selecting creates/assigns. Uses the existing `Command` (cmdk) primitive if available, otherwise a Popover + input pattern.
- `tag-filter.tsx` — a multi-select dropdown for the list pages that adds `tagIds` to the URL search params.

#### Documents list page — `t.$teamUrl+/documents._index.tsx`
- Add `tagIds` to `ZSearchParamsSchema` (parse from comma-separated query string).
- Pass `tagIds` into the `findDocuments` / `findDocumentsInternal` tRPC query.
- Render `<TagFilter type="DOCUMENT" />` in the filter toolbar alongside the period selector and search.
- Fetch tags via `trpc.tag.findTags.useQuery({ type: 'DOCUMENT' })` for the filter options.

#### Templates list page — `t.$teamUrl+/templates._index.tsx`
- Same changes as documents, with `type: 'TEMPLATE'`.

#### Tables — `documents-table.tsx` and `templates-table.tsx`
- Add a "Tags" column that renders `<TagBadge>` for each tag on the row.
- The row data already includes `tags` (from the hydration `include` added in step 3).

#### Document/template detail pages
- `documents.$id._index.tsx` / `templates.$id._index.tsx`: display assigned tags as badges.
- `documents.$id.edit.tsx` / `templates.$id.edit.tsx`: add a `<TagInput>` field that calls `trpc.tag.setEnvelopeTags.mutate` on change.

#### Tag management
- A lightweight management UI (rename/delete tags) can be added to team settings or as a small popover from the `<TagFilter>`. This can be a minimal first iteration (create via the tag-input inline, delete/rename via a settings page later).

### 6. V1 Public API (Deferred — Phase 2)

Once the tRPC + UI layer is stable, add to `packages/api/v1/`:
- `GET /api/v1/tags` — list tags (with `type` query param).
- `POST /api/v1/tags` — create tag.
- `POST /api/v1/tags/assign` — assign tags to an envelope.
- Add `tags` array to the document/template response schemas.
- Add `tagIds` filter to `GET /api/v1/documents`.

This mirrors exactly how folder support was added to the V1 API (see the `wild-teal-wind-add-folder-support-to-v1-api` plan).

## Implementation Order

1. **Prisma schema + migration** — add models, run migration, regenerate client (`zod-prisma-types` will generate `TagSchema`).
2. **Lib layer** — create `tag/` functions; extend `find-documents.ts` and `find-templates.ts` with `tagIds` filter + hydration.
3. **tRPC layer** — create `tag-router`, register it, extend find request schemas.
4. **UI primitives** — `TagBadge`, `TagInput`, `TagFilter`.
5. **List pages** — wire up `TagFilter` + tags column on documents and templates.
6. **Detail/edit pages** — display + assign tags.
7. **E2E tests** — tag CRUD, assign, filter.
8. *(Deferred)* V1 API endpoints.

## Testing

E2E tests in `packages/app-tests` following existing Playwright patterns:

1. Create a tag from the documents tag filter — verify it appears in the list.
2. Assign tags to a document from the edit page — verify badges appear on the table row.
3. Filter documents by a tag — verify only tagged documents show.
4. Filter by multiple tags (OR) — verify union of results.
5. Delete a tag — verify it's removed from all assigned documents.
6. Repeat 1–5 for templates.
7. Verify team scoping — tags from team A are not visible in team B.
8. Verify a DOCUMENT tag cannot be assigned to a TEMPLATE and vice versa.

## Migration & Compatibility Notes

- The new `Tag` and `EnvelopeTag` tables are purely additive — no existing columns are modified or removed.
- The `tags` relation added to `Envelope` is additive; existing queries that don't `include` it are unaffected.
- The `tagIds` filter is optional in all find functions; when omitted, behaviour is identical to today.
- No breaking changes to existing tRPC routes or V1 API responses (tags are added as new optional fields).
- The `zod-prisma-types` generator (already configured in `schema.prisma`) will auto-generate `TagSchema` for use in `tag-router/schema.ts`, same as `FolderSchema` is used in `folder-router/schema.ts`.

## Open Questions

1. **Tag name uniqueness scope** — Should uniqueness be `(teamId, name, type)` (case-insensitive) or should we allow duplicates and dedupe in the UI? **Recommendation:** enforce in DB (decision #5).
2. **Max tags per envelope** — Should there be a limit (e.g. 10)? **Recommendation:** no hard limit initially; can add a limit later.
3. **Bulk tag assignment** — Should the bulk action bar on the documents page support "add tag to all selected"? **Recommendation:** yes, as a follow-up; the `setEnvelopeTags` lib function can be extended to accept multiple envelope IDs, or a separate `bulkAssignTags` function can be added (mirroring `bulk-move-envelopes`).
4. **Tag colors** — Should we ship a fixed palette picker or allow free-form hex? **Recommendation:** fixed palette of ~8 colours for v1, stored as hex in the `color` column.