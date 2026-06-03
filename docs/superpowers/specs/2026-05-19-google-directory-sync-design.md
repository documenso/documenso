# Google Directory Sync — Phase 1 Design Spec

## Summary

Pull Google Workspace directory data (department, title, org unit, group memberships) on every SSO login and store it on the User record. Phase 1 is data collection only — no mapping rules or auto-team-assignment.

## Motivation

PSD401 needs department, title, and group membership data from Google Workspace to drive permission assignment in Documenso. Google SSO currently captures only email, name, and subject ID. This phase gets the data flowing so phase 2 can build config-based mapping rules on top.

## Prerequisites

- GCP service account with domain-wide delegation enabled
- Scopes granted in Google Admin console: `https://www.googleapis.com/auth/admin.directory.user.readonly`, `https://www.googleapis.com/auth/admin.directory.group.readonly`
- Service account impersonates a dedicated delegated admin account with only Directory read permissions (not a general admin or super admin), per [Google's DWD best practices](https://support.google.com/a/answer/14437356)
- Service account key stored as env var. Rotate manually on a periodic schedule, or eliminate keys entirely with GCP Workload Identity Federation (uses AWS IAM role to authenticate to GCP, no key to manage).
- Google Workspace audit logging enabled for the impersonated admin account to detect anomalous lookup volumes
- PSD401 Google Workspace has department, title, and orgUnitPath populated for users

## Schema Changes

Five new nullable columns on the `User` model:

| Field | Type | Example |
|---|---|---|
| `department` | `String?` | `"Technology"` |
| `title` | `String?` | `"Network Administrator"` |
| `orgUnitPath` | `String?` | `"/Staff/Technology"` |
| `googleGroups` | `Json?` | `["tech-staff@psd401.net", "all-staff@psd401.net"]` |
| `directoryLastSyncedAt` | `DateTime?` | `2026-05-19T14:30:00Z` |

All nullable — existing users unaffected. `googleGroups` validated at read time with `z.array(z.string())`.

Prisma migration adds these columns with no default values and no `NOT NULL` constraints.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Yes* | Service account JSON key as a string |
| `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` | Yes* | Alternative: path to JSON key file |
| `GOOGLE_DIRECTORY_ADMIN_EMAIL` | Yes | Admin email to impersonate for Directory API calls |
| `GOOGLE_DIRECTORY_SYNC_ENABLED` | No | `true`/`false`, defaults to `false` |

*One of the two key variables required. Feature does nothing when `GOOGLE_DIRECTORY_SYNC_ENABLED` is not `true`.

## Architecture

### New module: `packages/lib/server-only/google/directory-client.ts`

Authenticates using the service account JSON key and impersonates the admin email. Uses the `googleapis` npm package (`google.admin('directory_v1')`).

Exports:

- `getDirectoryUser(email: string)` — calls `admin.users.get({ userKey: email })`, returns `{ department: string | null, title: string | null, orgUnitPath: string | null }` or null on failure.
- `getDirectoryGroups(email: string)` — calls `admin.groups.list({ userKey: email })` and follows `nextPageToken` until all pages are fetched. Returns `string[]` of group email addresses on success (including empty array for users with no groups), or `null` on failure.

Both functions catch errors internally and return `null` on failure rather than throwing. Error logging uses `err.message` only, never raw error objects (the `googleapis` SDK attaches auth context including credential material to error objects). The caller logs and proceeds.

### New function: `packages/lib/server-only/user/sync-google-directory.ts`

`syncGoogleDirectory(userId: number, email: string): Promise<void>`

1. Checks `GOOGLE_DIRECTORY_SYNC_ENABLED === 'true'`. If not, returns immediately.
2. Queries `directoryLastSyncedAt` for the user. If synced within the last hour, returns early.
3. Calls `getDirectoryUser(email)` and `getDirectoryGroups(email)` in parallel.
4. Builds the update payload using only fields from successful calls:
   - If `getDirectoryUser` returned non-null, include `department`, `title`, `orgUnitPath` in the update.
   - If `getDirectoryGroups` returned non-null, include `googleGroups` in the update.
   - Fields from failed calls are omitted from the update, preserving previously stored values.
5. If at least one call succeeded, writes the update payload and sets `directoryLastSyncedAt` to now.
6. If both calls returned null (both failed), logs a warning and returns without updating. `directoryLastSyncedAt` is not advanced, so the next login retries immediately.

### Hook location: `packages/auth/server/lib/utils/handle-oauth-callback-url.ts`

The OAuth callback has three paths:

- **Path A** (existing OAuth account, line ~42): existing user logs in directly
- **Path B** (existing email user links OAuth, line ~63): OAuth account created, existing user logs in
- **Path C** (new user, line ~139): user + account created, `onCreateUserHook` called

`syncGoogleDirectory(userId, email)` is called in all three paths, but only when `clientOptions.id === 'google'`. The provider check is at the call site, before invoking the function. Microsoft and OIDC logins skip the sync entirely.

The call is awaited but wrapped in a try/catch at the call site. A failed directory sync logs `err.message` (not the raw error object) and proceeds to `onAuthorize()` without interrupting authentication.

### Feature gate

Two layers of gating:

1. **Provider check** (at the call site in `handleOAuthCallbackUrl`): `clientOptions.id === 'google'` — prevents the function from being called for Microsoft/OIDC logins.
2. **Env var check** (inside `syncGoogleDirectory`): `GOOGLE_DIRECTORY_SYNC_ENABLED === 'true'` — global kill switch. When disabled (the default), the function returns immediately. Safe to deploy without configuring the service account.

## Testing

### `syncGoogleDirectory` unit tests (mock directory-client functions)

- Feature gate disabled (`GOOGLE_DIRECTORY_SYNC_ENABLED` not `'true'`): returns immediately, no Prisma query, no API calls.
- Synced within last hour: returns early without calling directory APIs.
- Synced 61 minutes ago: proceeds with sync.
- `directoryLastSyncedAt` is null (first sync): proceeds with sync.
- Both API calls succeed: all five fields written to User, `directoryLastSyncedAt` set.
- `getDirectoryUser` succeeds, `getDirectoryGroups` returns null (fails): only `department`/`title`/`orgUnitPath` written; `googleGroups` unchanged; `directoryLastSyncedAt` set.
- `getDirectoryUser` returns null (fails), `getDirectoryGroups` succeeds: only `googleGroups` written; `department`/`title`/`orgUnitPath` unchanged; `directoryLastSyncedAt` set.
- Both calls return null: logs warning, no User update, `directoryLastSyncedAt` not advanced.
- Prisma query throws (DB unreachable): catches error, logs `err.message`, returns without blocking auth.

### `directory-client.ts` unit tests (mock `googleapis`)

- `getDirectoryUser`: correct auth setup (service account key, impersonated admin email, scopes).
- `getDirectoryUser`: returns `{ department, title, orgUnitPath }` on success.
- `getDirectoryUser`: returns `null` on API error (403, 404, network failure).
- `getDirectoryUser`: returns `null` on impersonation failure (invalid admin email).
- `getDirectoryUser`: logs `err.message` only, never raw error objects.
- `getDirectoryGroups`: follows pagination (`nextPageToken`) across multiple pages.
- `getDirectoryGroups`: returns `[]` for user with no groups (success, not failure).
- `getDirectoryGroups`: returns `null` on API error.
- `getDirectoryGroups`: handles malformed API response (non-string group entries) gracefully.

### `handleOAuthCallbackUrl` integration tests

- Google OAuth login (Path A, existing account): `syncGoogleDirectory` called with correct userId and email.
- Google OAuth login (Path B, account link): `syncGoogleDirectory` called.
- Google OAuth login (Path C, new user): `syncGoogleDirectory` called after `onCreateUserHook`.
- Microsoft OAuth login: `syncGoogleDirectory` not called (provider check).
- OIDC login: `syncGoogleDirectory` not called (provider check).

### Integration tests

- `describe.skipIf` when service account env vars aren't set (same pattern as LibreOffice/qpdf binary tests).

### Manual verification

- Deploy to dev (10.0.70.60), sign in with a PSD401 Google account, query the DB to confirm populated fields.

## Not in Scope (Phase 1)

- Mapping rules or auto-team-assignment (phase 2)
- Admin UI for viewing or managing directory data
- Periodic background sync
- SCIM or Google push notifications
- Changes to the existing `onCreateUserHook`

## Phase 2 Preview

Phase 2 adds a `DirectoryMapping` DB table with config-based rules (e.g., `department = "Technology"` maps to Team X). An admin UI under org settings manages the mappings. The sync function is extended to evaluate mapping rules after updating directory fields. Initially additive only (adds memberships, never removes), with authoritative sync as a later option.
