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

type AdminFindDocumentsResult = {
  data: Array<{ envelopeId: string; title: string }>;
  count: number;
};

const callAdminFindDocuments = async (page: Page, query: string) => {
  const inputParam = encodeURIComponent(JSON.stringify({ json: { query, page: 1, perPage: 20 } }));
  const url = `${WEBAPP_BASE_URL}/api/trpc/admin.document.find?input=${inputParam}`;

  const res = await page.context().request.get(url);

  return {
    res,
    result: res.ok()
      ? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        ((await res.json()).result.data.json as AdminFindDocumentsResult)
      : null,
  };
};

// ─── Access control ──────────────────────────────────────────────────────────

test('[ADMIN][TRPC][FIND_DOCUMENTS]: non-admin user is rejected with 401', async ({ page }) => {
  const { user: nonAdminUser } = await seedUser({ isAdmin: false });

  await apiSignin({ page, email: nonAdminUser.email });

  const { res } = await callAdminFindDocuments(page, 'recipient:anything');

  expect(res.ok()).toBeFalsy();
  expect(res.status()).toBe(401);
});

// ─── recipient: prefix ───────────────────────────────────────────────────────

test('[ADMIN][TRPC][FIND_DOCUMENTS]: recipient prefix matches by recipient email', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: sender, team } = await seedUser();

  const recipientEmail = `recipient-find-${nanoid()}@test.documenso.com`;

  const matchingDocument = await seedPendingDocument(sender, team.id, [recipientEmail], {
    createDocumentOptions: { title: `recipient-find-match-${nanoid()}` },
  });

  const otherDocument = await seedPendingDocument(sender, team.id, [`other-${nanoid()}@test.documenso.com`], {
    createDocumentOptions: { title: `recipient-find-other-${nanoid()}` },
  });

  await apiSignin({ page, email: adminUser.email });

  const { res, result } = await callAdminFindDocuments(page, `recipient:${recipientEmail}`);

  expect(res.ok()).toBeTruthy();
  expect(result?.count).toBe(1);
  expect(result?.data.map((document) => document.envelopeId)).toContain(matchingDocument.id);
  expect(result?.data.map((document) => document.envelopeId)).not.toContain(otherDocument.id);
});

test('[ADMIN][TRPC][FIND_DOCUMENTS]: recipient prefix matches by recipient name case-insensitively', async ({
  page,
}) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: sender, team } = await seedUser();

  const recipientName = `recipient-name-${nanoid()}`;
  const { user: recipientUser } = await seedUser({ name: recipientName });

  const matchingDocument = await seedPendingDocument(sender, team.id, [recipientUser], {
    createDocumentOptions: { title: `recipient-name-match-${nanoid()}` },
  });

  await apiSignin({ page, email: adminUser.email });

  // Query the uppercased name: matching must be case-insensitive.
  const { res, result } = await callAdminFindDocuments(page, `recipient:${recipientName.toUpperCase()}`);

  expect(res.ok()).toBeTruthy();
  expect(result?.count).toBe(1);
  expect(result?.data.map((document) => document.envelopeId)).toContain(matchingDocument.id);
});

test('[ADMIN][TRPC][FIND_DOCUMENTS]: recipient prefix with empty value returns no results', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  await apiSignin({ page, email: adminUser.email });

  const emptyValueSearch = await callAdminFindDocuments(page, 'recipient:');

  expect(emptyValueSearch.res.ok()).toBeTruthy();
  expect(emptyValueSearch.result?.data).toEqual([]);
  expect(emptyValueSearch.result?.count).toBe(0);

  // Whitespace-only values are treated the same as empty.
  const whitespaceValueSearch = await callAdminFindDocuments(page, 'recipient:   ');

  expect(whitespaceValueSearch.res.ok()).toBeTruthy();
  expect(whitespaceValueSearch.result?.data).toEqual([]);
  expect(whitespaceValueSearch.result?.count).toBe(0);
});

test('[ADMIN][TRPC][FIND_DOCUMENTS]: recipient prefix with no matches returns no results', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  await apiSignin({ page, email: adminUser.email });

  const { res, result } = await callAdminFindDocuments(page, 'recipient:zzzz-no-such-recipient-9x7q');

  expect(res.ok()).toBeTruthy();
  expect(result?.data).toEqual([]);
  expect(result?.count).toBe(0);
});

test('[ADMIN][TRPC][FIND_DOCUMENTS]: recipient prefix with numeric value matches by exact recipient ID', async ({
  page,
}) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: sender, team } = await seedUser();

  const matchingDocument = await seedPendingDocument(sender, team.id, [`recipient-id-${nanoid()}@test.documenso.com`], {
    createDocumentOptions: { title: `recipient-id-match-${nanoid()}` },
  });

  const recipient = matchingDocument.recipients[0];

  // A decoy whose recipient email contains the ID as text: an exact ID lookup
  // must exclude it, while an accidental "ID or contains" match would not.
  const decoyDocument = await seedPendingDocument(
    sender,
    team.id,
    [`decoy-${recipient.id}-${nanoid()}@test.documenso.com`],
    {
      createDocumentOptions: { title: `recipient-id-decoy-${nanoid()}` },
    },
  );

  await apiSignin({ page, email: adminUser.email });

  const { res, result } = await callAdminFindDocuments(page, `recipient:${recipient.id}`);

  expect(res.ok()).toBeTruthy();
  expect(result?.count).toBe(1);
  expect(result?.data.map((document) => document.envelopeId)).toContain(matchingDocument.id);
  expect(result?.data.map((document) => document.envelopeId)).not.toContain(decoyDocument.id);
});

test('[ADMIN][TRPC][FIND_DOCUMENTS]: recipient prefix with nonexistent recipient ID returns no results', async ({
  page,
}) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  await apiSignin({ page, email: adminUser.email });

  // Int4 max - 1: a valid ID-shaped number that no autoincrement recipient
  // sequence will plausibly reach, and that no other test seeds as text.
  const { res, result } = await callAdminFindDocuments(page, 'recipient:2147483646');

  expect(res.ok()).toBeTruthy();
  expect(result?.data).toEqual([]);
  expect(result?.count).toBe(0);
});

test('[ADMIN][TRPC][FIND_DOCUMENTS]: recipient prefix with oversized number falls back to text search', async ({
  page,
}) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: sender, team } = await seedUser();

  // 99999999999999 exceeds Int4, so it cannot be an ID lookup: it must be
  // treated as text (and must not 500).
  const oversizedNumber = '99999999999999';

  const matchingDocument = await seedPendingDocument(
    sender,
    team.id,
    [`${oversizedNumber}-${nanoid()}@test.documenso.com`],
    {
      createDocumentOptions: { title: `recipient-oversized-${nanoid()}` },
    },
  );

  await apiSignin({ page, email: adminUser.email });

  const { res, result } = await callAdminFindDocuments(page, `recipient:${oversizedNumber}`);

  expect(res.ok()).toBeTruthy();
  expect(result?.data.map((document) => document.envelopeId)).toContain(matchingDocument.id);
});

test('[ADMIN][TRPC][FIND_DOCUMENTS]: user and team prefixes with oversized numbers return no results', async ({
  page,
}) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  await apiSignin({ page, email: adminUser.email });

  // 99999999999999 exceeds Int4, so it can never be a valid user or team ID.
  // The ID schema must reject it so the query returns empty instead of
  // overflowing Postgres and erroring.
  const userSearch = await callAdminFindDocuments(page, 'user:99999999999999');

  expect(userSearch.res.ok()).toBeTruthy();
  expect(userSearch.result?.data).toEqual([]);
  expect(userSearch.result?.count).toBe(0);

  const teamSearch = await callAdminFindDocuments(page, 'team:99999999999999');

  expect(teamSearch.res.ok()).toBeTruthy();
  expect(teamSearch.result?.data).toEqual([]);
  expect(teamSearch.result?.count).toBe(0);
});
