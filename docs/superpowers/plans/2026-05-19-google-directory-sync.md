# Google Directory Sync (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pull department, title, orgUnitPath, and Google group memberships from the Google Admin SDK Directory API on every Google SSO login and store on the User record.

**Architecture:** A new `directory-client.ts` module handles Google Admin SDK auth and API calls via a service account with domain-wide delegation. A new `sync-google-directory.ts` orchestrator is called from the OAuth callback handler (Google provider only), gated behind an env var. Schema adds five nullable columns to User. TDD throughout.

**Tech Stack:** googleapis (Google Admin SDK), Prisma (schema migration), vitest (unit tests)

**Spec:** `docs/superpowers/specs/2026-05-19-google-directory-sync-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `packages/prisma/migrations/<timestamp>_add_google_directory_fields/migration.sql` | Add 5 nullable columns to User |
| Modify | `packages/prisma/schema.prisma` | Add fields to User model |
| Create | `packages/lib/server-only/google/directory-client.ts` | Google Admin SDK auth + API calls |
| Create | `packages/lib/server-only/google/directory-client.test.ts` | Unit tests for directory client |
| Create | `packages/lib/server-only/user/sync-google-directory.ts` | Sync orchestrator |
| Create | `packages/lib/server-only/user/sync-google-directory.test.ts` | Unit tests for sync orchestrator |
| Modify | `packages/auth/server/lib/utils/handle-oauth-callback-url.ts` | Add sync hook to all 3 OAuth paths |

---

### Task 1: Prisma Schema and Migration

**Files:**
- Modify: `packages/prisma/schema.prisma` (User model, around line 39)
- Create: `packages/prisma/migrations/<timestamp>_add_google_directory_fields/migration.sql`

- [ ] **Step 1: Add fields to the User model in schema.prisma**

Add these five fields after `disabled` (line 53) and before the relations block:

```prisma
  department             String?
  title                  String?
  orgUnitPath            String?
  googleGroups           Json?
  directoryLastSyncedAt  DateTime?
```

- [ ] **Step 2: Generate the Prisma migration**

Run:
```bash
cd /Users/HerberR_1/code/documenso && npx prisma migrate dev --name add_google_directory_fields --create-only
```

Expected: A new migration directory under `packages/prisma/migrations/` with a `migration.sql` containing:
```sql
ALTER TABLE "User" ADD COLUMN "department" TEXT;
ALTER TABLE "User" ADD COLUMN "title" TEXT;
ALTER TABLE "User" ADD COLUMN "orgUnitPath" TEXT;
ALTER TABLE "User" ADD COLUMN "googleGroups" JSONB;
ALTER TABLE "User" ADD COLUMN "directoryLastSyncedAt" TIMESTAMP(3);
```

- [ ] **Step 3: Verify the migration SQL**

Read the generated migration file and confirm:
- All five columns are present
- All columns are nullable (no `NOT NULL`)
- No default values
- `googleGroups` uses `JSONB` (Prisma's default JSON mapping for Postgres)

- [ ] **Step 4: Generate the Prisma client**

Run:
```bash
cd /Users/HerberR_1/code/documenso && npx prisma generate
```

Expected: Clean exit, no errors. The generated client now includes `department`, `title`, `orgUnitPath`, `googleGroups`, and `directoryLastSyncedAt` on the User type.

- [ ] **Step 5: Type check**

Run:
```bash
cd /Users/HerberR_1/code/documenso && npx -p typescript tsc --noEmit -p packages/prisma/tsconfig.json
```

Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/prisma/schema.prisma packages/prisma/migrations/
git commit -m "feat: add Google directory fields to User model

Add department, title, orgUnitPath, googleGroups, and
directoryLastSyncedAt as nullable columns for directory sync."
```

---

### Task 2: Install googleapis dependency

**Files:**
- Modify: `packages/lib/package.json`

- [ ] **Step 1: Add googleapis to @documenso/lib**

Run:
```bash
cd /Users/HerberR_1/code/documenso && bun add googleapis -w packages/lib
```

Expected: `googleapis` appears in `packages/lib/package.json` dependencies.

- [ ] **Step 2: Commit**

```bash
git add packages/lib/package.json bun.lock
git commit -m "deps: add googleapis to @documenso/lib for Admin SDK"
```

---

### Task 3: Directory Client — Tests First

**Files:**
- Create: `packages/lib/server-only/google/directory-client.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// ABOUTME: Unit tests for Google Directory API client.
// ABOUTME: Mocks googleapis to verify auth setup, user lookup, group pagination, and error handling.

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUsersGet = vi.fn();
const mockGroupsList = vi.fn();

vi.mock('googleapis', () => ({
  google: {
    auth: {
      GoogleAuth: vi.fn().mockImplementation(() => ({
        getClient: vi.fn().mockResolvedValue({}),
      })),
    },
    admin: vi.fn().mockReturnValue({
      users: { get: mockUsersGet },
      groups: { list: mockGroupsList },
    }),
  },
}));

vi.mock('@documenso/lib/utils/env', () => ({
  env: vi.fn((key: string) => {
    const vars: Record<string, string> = {
      GOOGLE_SERVICE_ACCOUNT_KEY: JSON.stringify({
        type: 'service_account',
        project_id: 'test-project',
        private_key_id: 'key-id',
        private_key: '-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----\n',
        client_email: 'test@test-project.iam.gserviceaccount.com',
        client_id: '123',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
      }),
      GOOGLE_DIRECTORY_ADMIN_EMAIL: 'admin@psd401.net',
    };
    return vars[key];
  }),
}));

describe('directory-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDirectoryUser', () => {
    it('should return department, title, and orgUnitPath on success', async () => {
      mockUsersGet.mockResolvedValue({
        data: {
          organizations: [{ department: 'Technology', title: 'Network Admin' }],
          orgUnitPath: '/Staff/Technology',
        },
      });

      const { getDirectoryUser } = await import('./directory-client');
      const result = await getDirectoryUser('user@psd401.net');

      expect(result).toEqual({
        department: 'Technology',
        title: 'Network Admin',
        orgUnitPath: '/Staff/Technology',
      });
      expect(mockUsersGet).toHaveBeenCalledWith({
        userKey: 'user@psd401.net',
        projection: 'full',
      });
    });

    it('should return null fields when user has no organizations', async () => {
      mockUsersGet.mockResolvedValue({
        data: {
          orgUnitPath: '/Staff',
        },
      });

      const { getDirectoryUser } = await import('./directory-client');
      const result = await getDirectoryUser('user@psd401.net');

      expect(result).toEqual({
        department: null,
        title: null,
        orgUnitPath: '/Staff',
      });
    });

    it('should return null on API error', async () => {
      mockUsersGet.mockRejectedValue(new Error('403 Forbidden'));

      const { getDirectoryUser } = await import('./directory-client');
      const result = await getDirectoryUser('user@psd401.net');

      expect(result).toBeNull();
    });

    it('should return null on impersonation failure', async () => {
      mockUsersGet.mockRejectedValue(new Error('401 Unauthorized: invalid_grant'));

      const { getDirectoryUser } = await import('./directory-client');
      const result = await getDirectoryUser('user@psd401.net');

      expect(result).toBeNull();
    });
  });

  describe('getDirectoryGroups', () => {
    it('should return group emails on success', async () => {
      mockGroupsList.mockResolvedValue({
        data: {
          groups: [
            { email: 'tech-staff@psd401.net' },
            { email: 'all-staff@psd401.net' },
          ],
        },
      });

      const { getDirectoryGroups } = await import('./directory-client');
      const result = await getDirectoryGroups('user@psd401.net');

      expect(result).toEqual(['tech-staff@psd401.net', 'all-staff@psd401.net']);
    });

    it('should follow pagination across multiple pages', async () => {
      mockGroupsList
        .mockResolvedValueOnce({
          data: {
            groups: [{ email: 'group1@psd401.net' }],
            nextPageToken: 'page2token',
          },
        })
        .mockResolvedValueOnce({
          data: {
            groups: [{ email: 'group2@psd401.net' }],
          },
        });

      const { getDirectoryGroups } = await import('./directory-client');
      const result = await getDirectoryGroups('user@psd401.net');

      expect(result).toEqual(['group1@psd401.net', 'group2@psd401.net']);
      expect(mockGroupsList).toHaveBeenCalledTimes(2);
    });

    it('should return empty array for user with no groups', async () => {
      mockGroupsList.mockResolvedValue({
        data: {},
      });

      const { getDirectoryGroups } = await import('./directory-client');
      const result = await getDirectoryGroups('user@psd401.net');

      expect(result).toEqual([]);
    });

    it('should return null on API error', async () => {
      mockGroupsList.mockRejectedValue(new Error('403 Forbidden'));

      const { getDirectoryGroups } = await import('./directory-client');
      const result = await getDirectoryGroups('user@psd401.net');

      expect(result).toBeNull();
    });

    it('should filter out non-string group entries', async () => {
      mockGroupsList.mockResolvedValue({
        data: {
          groups: [
            { email: 'valid@psd401.net' },
            { name: 'no-email-field' },
            {},
          ],
        },
      });

      const { getDirectoryGroups } = await import('./directory-client');
      const result = await getDirectoryGroups('user@psd401.net');

      expect(result).toEqual(['valid@psd401.net']);
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
cd /Users/HerberR_1/code/documenso && npx vitest run packages/lib/server-only/google/directory-client.test.ts
```

Expected: FAIL — `./directory-client` module does not exist yet.

- [ ] **Step 3: Commit the test file**

```bash
git add packages/lib/server-only/google/directory-client.test.ts
git commit -m "test: add failing tests for Google directory client"
```

---

### Task 4: Directory Client — Implementation

**Files:**
- Create: `packages/lib/server-only/google/directory-client.ts`

- [ ] **Step 1: Implement the directory client**

```typescript
// ABOUTME: Google Workspace Directory API client using service account with domain-wide delegation.
// ABOUTME: Exports getDirectoryUser and getDirectoryGroups, both return null on failure.

import { google } from 'googleapis';

import { env } from '@documenso/lib/utils/env';

type DirectoryUserResult = {
  department: string | null;
  title: string | null;
  orgUnitPath: string | null;
};

const getAdminClient = () => {
  const keyJson = env('GOOGLE_SERVICE_ACCOUNT_KEY');
  const keyFile = env('GOOGLE_SERVICE_ACCOUNT_KEY_FILE');
  const adminEmail = env('GOOGLE_DIRECTORY_ADMIN_EMAIL');

  if (!adminEmail) {
    throw new Error('GOOGLE_DIRECTORY_ADMIN_EMAIL is required');
  }

  const authOptions: Record<string, unknown> = {
    scopes: [
      'https://www.googleapis.com/auth/admin.directory.user.readonly',
      'https://www.googleapis.com/auth/admin.directory.group.readonly',
    ],
    subject: adminEmail,
  };

  if (keyJson) {
    const credentials = JSON.parse(keyJson) as Record<string, unknown>;
    authOptions.credentials = credentials;
  } else if (keyFile) {
    authOptions.keyFile = keyFile;
  } else {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_KEY_FILE is required');
  }

  const auth = new google.auth.GoogleAuth(authOptions);

  return google.admin({ version: 'directory_v1', auth });
};

export const getDirectoryUser = async (email: string): Promise<DirectoryUserResult | null> => {
  try {
    const admin = getAdminClient();

    const response = await admin.users.get({
      userKey: email,
      projection: 'full',
    });

    const data = response.data;
    const org = Array.isArray(data.organizations) ? data.organizations[0] : undefined;

    return {
      department: (org?.department as string) ?? null,
      title: (org?.title as string) ?? null,
      orgUnitPath: (data.orgUnitPath as string) ?? null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn(`[directory-sync] Failed to fetch user ${email}: ${message}`);
    return null;
  }
};

export const getDirectoryGroups = async (email: string): Promise<string[] | null> => {
  try {
    const admin = getAdminClient();
    const allGroupEmails: string[] = [];
    let pageToken: string | undefined;

    do {
      const response = await admin.groups.list({
        userKey: email,
        pageToken,
      });

      const groups = response.data.groups ?? [];

      for (const group of groups) {
        if (typeof group.email === 'string') {
          allGroupEmails.push(group.email);
        }
      }

      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    return allGroupEmails;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn(`[directory-sync] Failed to fetch groups for ${email}: ${message}`);
    return null;
  }
};
```

- [ ] **Step 2: Run the tests**

Run:
```bash
cd /Users/HerberR_1/code/documenso && npx vitest run packages/lib/server-only/google/directory-client.test.ts
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/lib/server-only/google/directory-client.ts
git commit -m "feat: add Google Directory API client with DWD auth"
```

---

### Task 5: Sync Orchestrator — Tests First

**Files:**
- Create: `packages/lib/server-only/user/sync-google-directory.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// ABOUTME: Unit tests for syncGoogleDirectory covering feature gate, cooldown, partial success, and error paths.
// ABOUTME: Mocks directory-client and Prisma to isolate orchestration logic.

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetDirectoryUser = vi.fn();
const mockGetDirectoryGroups = vi.fn();

vi.mock('../google/directory-client', () => ({
  getDirectoryUser: mockGetDirectoryUser,
  getDirectoryGroups: mockGetDirectoryGroups,
}));

const mockUserFindUnique = vi.fn();
const mockUserUpdate = vi.fn();

vi.mock('@documenso/prisma', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      update: mockUserUpdate,
    },
  },
}));

let mockEnvValues: Record<string, string | undefined> = {};

vi.mock('@documenso/lib/utils/env', () => ({
  env: vi.fn((key: string) => mockEnvValues[key]),
}));

describe('syncGoogleDirectory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockEnvValues = {
      GOOGLE_DIRECTORY_SYNC_ENABLED: 'true',
    };
  });

  it('should return immediately when feature is disabled', async () => {
    mockEnvValues = {};

    const { syncGoogleDirectory } = await import('./sync-google-directory');
    await syncGoogleDirectory(1, 'user@psd401.net');

    expect(mockUserFindUnique).not.toHaveBeenCalled();
    expect(mockGetDirectoryUser).not.toHaveBeenCalled();
  });

  it('should skip sync when synced within last hour', async () => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    mockUserFindUnique.mockResolvedValue({
      directoryLastSyncedAt: thirtyMinutesAgo,
    });

    const { syncGoogleDirectory } = await import('./sync-google-directory');
    await syncGoogleDirectory(1, 'user@psd401.net');

    expect(mockGetDirectoryUser).not.toHaveBeenCalled();
    expect(mockGetDirectoryGroups).not.toHaveBeenCalled();
  });

  it('should proceed when synced 61 minutes ago', async () => {
    const sixtyOneMinutesAgo = new Date(Date.now() - 61 * 60 * 1000);
    mockUserFindUnique.mockResolvedValue({
      directoryLastSyncedAt: sixtyOneMinutesAgo,
    });
    mockGetDirectoryUser.mockResolvedValue({
      department: 'Tech',
      title: 'Admin',
      orgUnitPath: '/Staff',
    });
    mockGetDirectoryGroups.mockResolvedValue(['group@psd401.net']);

    const { syncGoogleDirectory } = await import('./sync-google-directory');
    await syncGoogleDirectory(1, 'user@psd401.net');

    expect(mockGetDirectoryUser).toHaveBeenCalledWith('user@psd401.net');
    expect(mockUserUpdate).toHaveBeenCalled();
  });

  it('should proceed when directoryLastSyncedAt is null (first sync)', async () => {
    mockUserFindUnique.mockResolvedValue({
      directoryLastSyncedAt: null,
    });
    mockGetDirectoryUser.mockResolvedValue({
      department: 'Tech',
      title: 'Admin',
      orgUnitPath: '/Staff',
    });
    mockGetDirectoryGroups.mockResolvedValue(['group@psd401.net']);

    const { syncGoogleDirectory } = await import('./sync-google-directory');
    await syncGoogleDirectory(1, 'user@psd401.net');

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        department: 'Tech',
        title: 'Admin',
        orgUnitPath: '/Staff',
        googleGroups: ['group@psd401.net'],
        directoryLastSyncedAt: expect.any(Date),
      }),
    });
  });

  it('should update all fields when both API calls succeed', async () => {
    mockUserFindUnique.mockResolvedValue({ directoryLastSyncedAt: null });
    mockGetDirectoryUser.mockResolvedValue({
      department: 'Technology',
      title: 'Network Administrator',
      orgUnitPath: '/Staff/Technology',
    });
    mockGetDirectoryGroups.mockResolvedValue([
      'tech-staff@psd401.net',
      'all-staff@psd401.net',
    ]);

    const { syncGoogleDirectory } = await import('./sync-google-directory');
    await syncGoogleDirectory(1, 'user@psd401.net');

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        department: 'Technology',
        title: 'Network Administrator',
        orgUnitPath: '/Staff/Technology',
        googleGroups: ['tech-staff@psd401.net', 'all-staff@psd401.net'],
        directoryLastSyncedAt: expect.any(Date),
      },
    });
  });

  it('should only update user fields when getDirectoryGroups fails', async () => {
    mockUserFindUnique.mockResolvedValue({ directoryLastSyncedAt: null });
    mockGetDirectoryUser.mockResolvedValue({
      department: 'Tech',
      title: 'Admin',
      orgUnitPath: '/Staff',
    });
    mockGetDirectoryGroups.mockResolvedValue(null);

    const { syncGoogleDirectory } = await import('./sync-google-directory');
    await syncGoogleDirectory(1, 'user@psd401.net');

    const updateCall = mockUserUpdate.mock.calls[0][0];
    expect(updateCall.data).toHaveProperty('department', 'Tech');
    expect(updateCall.data).toHaveProperty('title', 'Admin');
    expect(updateCall.data).toHaveProperty('orgUnitPath', '/Staff');
    expect(updateCall.data).not.toHaveProperty('googleGroups');
    expect(updateCall.data).toHaveProperty('directoryLastSyncedAt');
  });

  it('should only update groups when getDirectoryUser fails', async () => {
    mockUserFindUnique.mockResolvedValue({ directoryLastSyncedAt: null });
    mockGetDirectoryUser.mockResolvedValue(null);
    mockGetDirectoryGroups.mockResolvedValue(['group@psd401.net']);

    const { syncGoogleDirectory } = await import('./sync-google-directory');
    await syncGoogleDirectory(1, 'user@psd401.net');

    const updateCall = mockUserUpdate.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty('department');
    expect(updateCall.data).not.toHaveProperty('title');
    expect(updateCall.data).not.toHaveProperty('orgUnitPath');
    expect(updateCall.data).toHaveProperty('googleGroups', ['group@psd401.net']);
    expect(updateCall.data).toHaveProperty('directoryLastSyncedAt');
  });

  it('should not update when both API calls fail', async () => {
    mockUserFindUnique.mockResolvedValue({ directoryLastSyncedAt: null });
    mockGetDirectoryUser.mockResolvedValue(null);
    mockGetDirectoryGroups.mockResolvedValue(null);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { syncGoogleDirectory } = await import('./sync-google-directory');
    await syncGoogleDirectory(1, 'user@psd401.net');

    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('should catch and log Prisma errors without throwing', async () => {
    mockUserFindUnique.mockRejectedValue(new Error('DB connection refused'));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { syncGoogleDirectory } = await import('./sync-google-directory');

    await expect(
      syncGoogleDirectory(1, 'user@psd401.net'),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/HerberR_1/code/documenso && npx vitest run packages/lib/server-only/user/sync-google-directory.test.ts
```

Expected: FAIL — `./sync-google-directory` module does not exist yet.

- [ ] **Step 3: Commit the test file**

```bash
git add packages/lib/server-only/user/sync-google-directory.test.ts
git commit -m "test: add failing tests for sync-google-directory orchestrator"
```

---

### Task 6: Sync Orchestrator — Implementation

**Files:**
- Create: `packages/lib/server-only/user/sync-google-directory.ts`

- [ ] **Step 1: Implement the sync orchestrator**

```typescript
// ABOUTME: Orchestrates Google Directory data sync on SSO login.
// ABOUTME: Calls directory-client APIs, builds partial update payload, writes to User record.

import { prisma } from '@documenso/prisma';

import { env } from '../../utils/env';
import { getDirectoryGroups, getDirectoryUser } from '../google/directory-client';

const ONE_HOUR_MS = 60 * 60 * 1000;

export const syncGoogleDirectory = async (
  userId: number,
  email: string,
): Promise<void> => {
  try {
    if (env('GOOGLE_DIRECTORY_SYNC_ENABLED') !== 'true') {
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { directoryLastSyncedAt: true },
    });

    if (user?.directoryLastSyncedAt) {
      const elapsed = Date.now() - user.directoryLastSyncedAt.getTime();

      if (elapsed < ONE_HOUR_MS) {
        return;
      }
    }

    const [userResult, groupsResult] = await Promise.all([
      getDirectoryUser(email),
      getDirectoryGroups(email),
    ]);

    if (userResult === null && groupsResult === null) {
      console.warn(
        `[directory-sync] Both API calls failed for ${email}, skipping update`,
      );
      return;
    }

    const updateData: Record<string, unknown> = {
      directoryLastSyncedAt: new Date(),
    };

    if (userResult !== null) {
      updateData.department = userResult.department;
      updateData.title = userResult.title;
      updateData.orgUnitPath = userResult.orgUnitPath;
    }

    if (groupsResult !== null) {
      updateData.googleGroups = groupsResult;
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn(`[directory-sync] Sync failed for user ${userId}: ${message}`);
  }
};
```

- [ ] **Step 2: Run the tests**

Run:
```bash
cd /Users/HerberR_1/code/documenso && npx vitest run packages/lib/server-only/user/sync-google-directory.test.ts
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/lib/server-only/user/sync-google-directory.ts
git commit -m "feat: add sync-google-directory orchestrator"
```

---

### Task 7: Hook into OAuth Callback

**Files:**
- Modify: `packages/auth/server/lib/utils/handle-oauth-callback-url.ts`

- [ ] **Step 1: Add the import**

At the top of the file, after the existing imports (after line 18 `import { onAuthorize } from './authorizer';`), add:

```typescript
import { syncGoogleDirectory } from '@documenso/lib/server-only/user/sync-google-directory';
```

- [ ] **Step 2: Add sync to Path A (existing OAuth account)**

In the `if (existingAccount)` block (around line 57), insert the sync call before `onAuthorize`:

Replace:
```typescript
  if (existingAccount) {
    await onAuthorize({ userId: existingAccount.user.id }, c);

    return c.redirect(redirectPath, 302);
  }
```

With:
```typescript
  if (existingAccount) {
    if (clientOptions.id === 'google') {
      await syncGoogleDirectory(existingAccount.user.id, email).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.warn(`[directory-sync] Sync failed: ${message}`);
      });
    }

    await onAuthorize({ userId: existingAccount.user.id }, c);

    return c.redirect(redirectPath, 302);
  }
```

- [ ] **Step 3: Add sync to Path B (existing email user, new OAuth link)**

In the `if (userWithSameEmail)` block, after the transaction and before `onAuthorize` (around line 115), insert:

Replace:
```typescript
    await onAuthorize({ userId: userWithSameEmail.id }, c);

    return c.redirect(redirectPath, 302);
  }
```

With:
```typescript
    if (clientOptions.id === 'google') {
      await syncGoogleDirectory(userWithSameEmail.id, email).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.warn(`[directory-sync] Sync failed: ${message}`);
      });
    }

    await onAuthorize({ userId: userWithSameEmail.id }, c);

    return c.redirect(redirectPath, 302);
  }
```

- [ ] **Step 4: Add sync to Path C (new user)**

After `onCreateUserHook` and before `onAuthorize` (around line 169), insert:

Replace:
```typescript
  await onCreateUserHook(createdUser).catch((err) => {
    // Todo: (RR7) Add logging.
    console.error(err);
  });

  await onAuthorize({ userId: createdUser.id }, c);
```

With:
```typescript
  await onCreateUserHook(createdUser).catch((err) => {
    // Todo: (RR7) Add logging.
    console.error(err);
  });

  if (clientOptions.id === 'google') {
    await syncGoogleDirectory(createdUser.id, email).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`[directory-sync] Sync failed: ${message}`);
    });
  }

  await onAuthorize({ userId: createdUser.id }, c);
```

- [ ] **Step 5: Type check the auth package**

Run:
```bash
cd /Users/HerberR_1/code/documenso && npx -p typescript tsc --noEmit -p packages/auth/tsconfig.json
```

Expected: No type errors.

- [ ] **Step 6: Run existing tests to verify no regressions**

Run:
```bash
cd /Users/HerberR_1/code/documenso && npx vitest run packages/lib/server-only/user/ && npx vitest run packages/lib/server-only/google/
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/auth/server/lib/utils/handle-oauth-callback-url.ts
git commit -m "feat: hook syncGoogleDirectory into Google OAuth callback

Calls sync in all three OAuth paths (existing account, account link,
new user) but only for Google provider. Microsoft and OIDC skip.
Errors caught and logged without blocking authentication."
```

---

### Task 8: Full Test Suite Run and Type Check

**Files:** None (verification only)

- [ ] **Step 1: Run all directory sync tests**

Run:
```bash
cd /Users/HerberR_1/code/documenso && npx vitest run packages/lib/server-only/google/directory-client.test.ts packages/lib/server-only/user/sync-google-directory.test.ts
```

Expected: All tests PASS.

- [ ] **Step 2: Run the full lib test suite**

Run:
```bash
cd /Users/HerberR_1/code/documenso && npx vitest run -w packages/lib
```

Expected: All tests PASS, no regressions.

- [ ] **Step 3: Type check**

Run:
```bash
cd /Users/HerberR_1/code/documenso && npx -p typescript tsc --noEmit
```

Expected: No type errors across the monorepo.
