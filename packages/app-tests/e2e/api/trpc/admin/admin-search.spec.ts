import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { seedPendingDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { customAlphabet } from 'nanoid';

import { apiSignin } from '../../../fixtures/authentication';

const nanoid = customAlphabet('1234567890abcdef', 10);

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({ mode: 'parallel' });

type AdminSearchGroup = {
  type: string;
  results: Array<{ label: string; sublabel?: string; path: string; value: string }>;
};

const callAdminSearch = async (page: Page, query: string) => {
  const inputParam = encodeURIComponent(JSON.stringify({ json: { query } }));
  const url = `${WEBAPP_BASE_URL}/api/trpc/admin.search?input=${inputParam}`;

  const res = await page.context().request.get(url);

  return {
    res,
    groups: res.ok()
      ? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        ((await res.json()).result.data.json.groups as AdminSearchGroup[])
      : null,
  };
};

const findGroup = (groups: AdminSearchGroup[] | null, type: string) =>
  (groups ?? []).find((group) => group.type === type);

// ─── Access control ──────────────────────────────────────────────────────────

test('[ADMIN][TRPC][SEARCH]: unauthenticated request is rejected with 401', async ({ page }) => {
  const { res } = await callAdminSearch(page, 'anything');

  expect(res.ok()).toBeFalsy();
  expect(res.status()).toBe(401);
});

test('[ADMIN][TRPC][SEARCH]: non-admin authenticated user is rejected with 401', async ({ page }) => {
  const { user: nonAdminUser } = await seedUser({ isAdmin: false });

  await apiSignin({ page, email: nonAdminUser.email });

  const { res } = await callAdminSearch(page, 'anything');

  expect(res.ok()).toBeFalsy();
  expect(res.status()).toBe(401);
});

// ─── Numeric queries: verified ID lookups ────────────────────────────────────

test('[ADMIN][TRPC][SEARCH]: numeric query returns verified user and team rows', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: targetUser, team: targetTeam } = await seedUser();

  await apiSignin({ page, email: adminUser.email });

  // Search by user ID.
  const userSearch = await callAdminSearch(page, String(targetUser.id));

  expect(userSearch.res.ok()).toBeTruthy();

  const userGroup = findGroup(userSearch.groups, 'user');
  expect(userGroup).toBeDefined();
  expect(userGroup?.results).toHaveLength(1);
  expect(userGroup?.results[0].path).toBe(`/admin/users/${targetUser.id}`);
  expect(userGroup?.results[0].sublabel).toContain(targetUser.email);

  // The cmdk `value` contract: value must contain the raw query.
  expect(userGroup?.results[0].value).toContain(String(targetUser.id));

  // Search by team ID.
  const teamSearch = await callAdminSearch(page, String(targetTeam.id));

  expect(teamSearch.res.ok()).toBeTruthy();

  const teamGroup = findGroup(teamSearch.groups, 'team');
  expect(teamGroup).toBeDefined();
  expect(teamGroup?.results).toHaveLength(1);
  expect(teamGroup?.results[0].path).toBe(`/admin/teams/${targetTeam.id}`);
  expect(teamGroup?.results[0].label).toBe(targetTeam.name);
});

test('[ADMIN][TRPC][SEARCH]: numeric query returns verified document and recipient rows', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: sender, team } = await seedUser();
  const { user: recipientUser } = await seedUser();

  const document = await seedPendingDocument(sender, team.id, [recipientUser]);
  const legacyDocumentId = document.secondaryId.replace('document_', '');
  const recipient = document.recipients[0];

  await apiSignin({ page, email: adminUser.email });

  // Search by legacy document ID (bare number).
  const documentSearch = await callAdminSearch(page, legacyDocumentId);

  expect(documentSearch.res.ok()).toBeTruthy();

  const documentGroup = findGroup(documentSearch.groups, 'document');
  expect(documentGroup).toBeDefined();
  expect(documentGroup?.results).toHaveLength(1);
  expect(documentGroup?.results[0].path).toBe(`/admin/documents/${document.id}`);
  expect(documentGroup?.results[0].label).toBe(document.title);

  // Search by recipient ID: links to the parent document.
  const recipientSearch = await callAdminSearch(page, String(recipient.id));

  expect(recipientSearch.res.ok()).toBeTruthy();

  const recipientGroup = findGroup(recipientSearch.groups, 'recipient');
  expect(recipientGroup).toBeDefined();
  expect(recipientGroup?.results).toHaveLength(1);
  expect(recipientGroup?.results[0].path).toBe(`/admin/documents/${document.id}`);
  expect(recipientGroup?.results[0].label).toBe(recipient.email);

  // Search by the full document_<id> secondary ID: exercises the prefix branch.
  const secondaryIdSearch = await callAdminSearch(page, document.secondaryId);

  expect(secondaryIdSearch.res.ok()).toBeTruthy();

  const secondaryIdGroup = findGroup(secondaryIdSearch.groups, 'document');
  expect(secondaryIdGroup).toBeDefined();
  expect(secondaryIdGroup?.results[0].path).toBe(`/admin/documents/${document.id}`);
});

test('[ADMIN][TRPC][SEARCH]: numeric query with no matches returns no groups', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  await apiSignin({ page, email: adminUser.email });

  const { res, groups } = await callAdminSearch(page, '999999999');

  expect(res.ok()).toBeTruthy();
  expect(groups).toEqual([]);
});

test('[ADMIN][TRPC][SEARCH]: oversized number does not error and falls back to text search', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: sender, team } = await seedUser();

  // 99999999999999 exceeds Int4, so it cannot be an ID lookup: it must be
  // treated as text (and must not 500).
  const oversizedNumber = '99999999999999';

  const document = await seedPendingDocument(sender, team.id, [], {
    createDocumentOptions: { title: `${oversizedNumber}-${nanoid()}` },
  });

  await apiSignin({ page, email: adminUser.email });

  const { res, groups } = await callAdminSearch(page, oversizedNumber);

  expect(res.ok()).toBeTruthy();

  const documentGroup = findGroup(groups, 'document');
  expect(documentGroup).toBeDefined();
  expect(documentGroup?.results.map((result) => result.path)).toContain(`/admin/documents/${document.id}`);
});

// ─── Prefixed ID queries: exact lookups ──────────────────────────────────────

test('[ADMIN][TRPC][SEARCH]: envelope_ and org_ prefixes resolve exact matches', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: sender, organisation, team } = await seedUser();

  const document = await seedPendingDocument(sender, team.id, []);

  await apiSignin({ page, email: adminUser.email });

  // envelope_<id> resolves the document.
  const envelopeSearch = await callAdminSearch(page, document.id);

  expect(envelopeSearch.res.ok()).toBeTruthy();

  const documentGroup = findGroup(envelopeSearch.groups, 'document');
  expect(documentGroup).toBeDefined();
  expect(documentGroup?.results[0].path).toBe(`/admin/documents/${document.id}`);

  // Only the document group is returned for a recognized prefix.
  expect(envelopeSearch.groups).toHaveLength(1);

  // org_<id> resolves the organisation.
  const orgSearch = await callAdminSearch(page, organisation.id);

  expect(orgSearch.res.ok()).toBeTruthy();

  const orgGroup = findGroup(orgSearch.groups, 'organisation');
  expect(orgGroup).toBeDefined();
  expect(orgGroup?.results[0].path).toBe(`/admin/organisations/${organisation.id}`);
  expect(orgGroup?.results[0].label).toBe(organisation.name);

  // Only the organisation group is returned for a recognized prefix.
  expect(orgSearch.groups).toHaveLength(1);
});

// ─── Free text queries ───────────────────────────────────────────────────────

test('[ADMIN][TRPC][SEARCH]: text query matches documents by title and users by email', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: sender, team } = await seedUser();

  // A unique title: the default seeded title is shared across the whole suite,
  // and global search only returns the newest few matches.
  const document = await seedPendingDocument(sender, team.id, [], {
    createDocumentOptions: { title: `admin-search-${nanoid()}` },
  });

  await apiSignin({ page, email: adminUser.email });

  // Search by document title.
  const titleSearch = await callAdminSearch(page, document.title);

  expect(titleSearch.res.ok()).toBeTruthy();

  const documentGroup = findGroup(titleSearch.groups, 'document');
  expect(documentGroup).toBeDefined();
  expect(documentGroup?.results.map((result) => result.path)).toContain(`/admin/documents/${document.id}`);

  // Search by user email (emails are unique nanoid-based, so this is specific).
  const emailSearch = await callAdminSearch(page, sender.email);

  expect(emailSearch.res.ok()).toBeTruthy();

  const userGroup = findGroup(emailSearch.groups, 'user');
  expect(userGroup).toBeDefined();
  expect(userGroup?.results[0].path).toBe(`/admin/users/${sender.id}`);
});

test('[ADMIN][TRPC][SEARCH]: gibberish query returns no groups', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  await apiSignin({ page, email: adminUser.email });

  const { res, groups } = await callAdminSearch(page, 'zzzz-no-such-thing-9x7q');

  expect(res.ok()).toBeTruthy();
  expect(groups).toEqual([]);
});
