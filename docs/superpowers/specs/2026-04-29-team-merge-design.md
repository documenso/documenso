# Team Merge Feature — Design Spec

## Overview

Org admins can merge multiple teams into one destination team (existing or new) from the Teams settings page. All documents, templates, folders, and members move to the destination. Source teams are permanently deleted. Webhooks, API tokens, and team settings from source teams are discarded.

## UI Flow

### Teams Settings Page (`/o/{orgUrl}/settings/teams`)

Add a checkbox column to `OrganisationTeamsTable`. When 2+ teams are selected, a "Merge Teams" button appears above the table.

### TeamMergeDialog

Opens when the merge button is clicked.

**Destination picker:** Dropdown listing all org teams NOT in the source selection, plus a "Create new team" option. Selecting "Create new team" shows inline name and URL inputs.

**Impact summary:** Fetched from server via `team.mergePreview` after sources are selected. Two sections:

Moving:
- X documents
- Y templates
- Z members (added as Member role)
- W folders

Discarding:
- A webhooks
- B API tokens
- C team email configurations
- D team settings profiles

**Warning banner** (destructive variant): "This action cannot be undone. All documents, templates, and folders from the selected teams will be moved to the destination team. Source team webhooks, API tokens, email configurations, and settings will be permanently deleted. Source teams will be removed."

**Confirmation input:** User must type the destination team name to confirm.

**Action button:** "Merge Teams" (destructive variant), disabled until confirmation text matches.

## Backend

### TRPC Routes

Two new procedures on the existing team router (`packages/trpc/server/team-router/router.ts`):

**`team.mergePreview`** (GET)
- Input: `{ organisationId, sourceTeamIds, destinationTeamId? }`
- Output: counts of documents, templates, folders, members, webhooks, API tokens, team emails, team settings that will be moved or discarded
- Permission: `MANAGE_ORGANISATION`
- Read-only — no mutations

**`team.merge`** (POST)
- Input: `{ organisationId, sourceTeamIds, destinationTeamId?, newTeamName?, newTeamUrl? }`
- `destinationTeamId` is required when merging into an existing team
- `newTeamName` and `newTeamUrl` are required when creating a new destination
- Permission: `MANAGE_ORGANISATION`
- Returns: summary of what was moved and discarded

### Server Function

New file: `packages/lib/server-only/team/merge-teams.ts`

Single Prisma `$transaction`:

1. Validate org ownership: fetch all source teams with `WHERE id IN (sourceTeamIds) AND organisationId = callerOrgId`. Assert the returned count equals `sourceTeamIds.length` — reject the request if any source team belongs to a different org. Apply the same validation to `destinationTeamId` if provided.
2. If destination is among the source teams, exclude it from the deletion list. After exclusion, assert the remaining source list is non-empty — throw a validation error if all sources equal the destination (silent no-op prevention).
3. If creating a new team, create it first within the transaction (reuse the same URL validation from `createTeam`).
4. Fetch pre-merge counts for the return value.
5. `UPDATE "Envelope" SET "teamId" = dest WHERE "teamId" IN (sources)` — `userId` is preserved (tracks original document creator, not team ownership).
6. `UPDATE "Folder" SET "teamId" = dest WHERE "teamId" IN (sources)` — `userId` is preserved (tracks original folder creator, not team ownership).
7. Consolidate members: team membership is via `TeamGroup` records (linking `OrganisationGroup` to `Team` with a `TeamMemberRole`). Filter out `TeamGroup` records where `organisationGroup.type === INTERNAL_TEAM` (these are team-scoped internal groups that must not be copied). For each remaining source `TeamGroup`, upsert into the destination team: `INSERT ... ON CONFLICT (teamId, organisationGroupId) DO NOTHING` with role MEMBER (least privilege). This avoids the check-then-insert race condition and respects the `@@unique([teamId, organisationGroupId])` constraint. Groups already linked to the destination keep their existing role.
8. Delete source teams — Prisma cascade handles: TeamProfile, Webhook, ApiToken, TeamGroup, TeamEmail, TeamEmailVerification. Explicitly delete orphaned `TeamGlobalSettings` rows (the FK lives on `Team.teamGlobalSettingsId` pointing at settings — cascade goes the wrong direction, so team deletion does NOT auto-delete settings). Collect `teamGlobalSettingsId` values from source teams before deletion, then `deleteMany` after.
9. Clean up orphaned `INTERNAL_TEAM` OrganisationGroups that have no remaining `TeamGroup` records (same pattern as `delete-team.ts`).
10. Return counts of moved and discarded items.

### Preview Function

Co-located in `packages/lib/server-only/team/merge-teams.ts` as a separate exported function sharing the same count-query helper. Both `mergeTeams` and `mergeTeamsPreview` call the shared helper; preview returns counts without mutating. Org ownership validation (step 1) applies to preview as well.

## Data Model

Tables affected during merge (8 tables reference `teamId`):

| Table | Merge behavior |
|---|---|
| Envelope | Reparent to destination |
| Folder | Reparent to destination |
| TeamGroup | Consolidate into destination — new TeamGroup records with MEMBER role for groups not already linked |
| TeamProfile | Discarded (cascade delete with source team) |
| Webhook | Discarded (cascade delete) |
| ApiToken | Discarded (cascade delete) |
| TeamEmail | Discarded (cascade delete) |
| TeamEmailVerification | Discarded (cascade delete) |
| TeamGlobalSettings | Discarded (explicit delete required — FK on Team points at settings, so cascade does NOT auto-delete settings when team is deleted) |

## Permissions

- Requires `MANAGE_ORGANISATION` role on the organisation
- Uses `buildOrganisationWhereQuery` pattern consistent with `createTeam` and `deleteTeam`
- All team IDs in the request (sourceTeamIds, destinationTeamId) are validated against the caller's organisationId inside the transaction — prevents cross-org IDOR where an attacker supplies team IDs from another organisation

## Edge Cases

- **Destination is one of the selected teams:** Valid. That team absorbs the others and is excluded from deletion.
- **Active signing sessions (PENDING envelopes):** Unaffected. Signing tokens resolve by recipient ID, not team ID.
- **Folder name collisions:** Both folders keep their names. Folders are identified by ID, not name uniqueness.
- **Empty source teams:** Allowed. Impact summary shows 0 counts. Source team is deleted.
- **Transaction failure:** Full rollback. No partial merges.
- **Concurrent merges on same teams:** Use `SELECT ... FOR UPDATE` on the destination team row at the start of the transaction to serialize concurrent merges. The upsert pattern for TeamGroup consolidation (ON CONFLICT DO NOTHING) also prevents unique constraint crashes. Second merge attempting the same destination blocks until the first completes, then fails cleanly on missing source teams.
- **Member role conflicts:** All merged members get MEMBER role regardless of their role on the source team (least privilege). If user is already on destination team, their existing role is preserved — no downgrade.
- **All sources equal destination:** Rejected with validation error. After excluding the destination from the source list, the remaining list must be non-empty.
- **Document/folder ownership after reparent:** `userId` on Envelope and Folder is preserved (tracks the original creator). Team ownership is determined by `teamId`, not `userId`.

## Files to Create/Modify

| File | Action |
|---|---|
| `packages/lib/server-only/team/merge-teams.ts` | New — merge transaction logic, preview function, and shared count helper |
| `packages/lib/server-only/team/__tests__/merge-teams.test.ts` | New — integration tests for merge and preview |
| `packages/trpc/server/team-router/merge-teams.ts` | New — TRPC merge route |
| `packages/trpc/server/team-router/merge-teams-preview.ts` | New — TRPC preview route |
| `packages/trpc/server/team-router/merge-teams.types.ts` | New — request/response schemas for both merge and preview |
| `packages/trpc/server/team-router/router.ts` | Modify — register merge and mergePreview procedures |
| `apps/remix/app/components/dialogs/team-merge-dialog.tsx` | New — merge dialog component |
| `apps/remix/app/routes/_authenticated+/o.$orgUrl.settings.teams.tsx` | Modify — add checkboxes and merge button |
