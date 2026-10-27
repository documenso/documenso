import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import type { TCreateEmailSuppressionRequest } from '@documenso/trpc/server/admin-router/email-suppression/create-email-suppression.types';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { apiSignin, WEBAPP_ORIGIN_HEADERS } from '../../../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({ mode: 'parallel' });

const testEmail = () => `suppressed-${nanoid(8)}@test.documenso.com`.toLowerCase();

const callCreateEmailSuppression = async (page: Page, input: TCreateEmailSuppressionRequest) => {
  return await page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/admin.emailSuppression.create`, {
    headers: { ...WEBAPP_ORIGIN_HEADERS, 'content-type': 'application/json' },
    data: JSON.stringify({ json: input }),
  });
};

test('[ADMIN][TRPC][EMAIL_SUPPRESSION]: non-admin users cannot create suppressions', async ({ page }) => {
  const { user } = await seedUser({ isAdmin: false });

  const email = testEmail();

  await apiSignin({ page, email: user.email });

  const res = await callCreateEmailSuppression(page, { email, target: { scope: 'GLOBAL' } });

  expect(res.status()).toBe(401);
  expect(await prisma.emailSuppression.count({ where: { email } })).toBe(0);
});

test('[ADMIN][TRPC][EMAIL_SUPPRESSION]: rejects a sender that does not exist', async ({ page }) => {
  const { user: admin } = await seedUser({ isAdmin: true });

  const email = testEmail();

  await apiSignin({ page, email: admin.email });

  const res = await callCreateEmailSuppression(page, {
    email,
    target: { scope: 'TEAM', teamId: 2_000_000_000 },
  });

  expect(res.status()).toBe(404);
  expect(await prisma.emailSuppression.count({ where: { email } })).toBe(0);
});

test('[ADMIN][TRPC][EMAIL_SUPPRESSION]: rejects a duplicate suppression', async ({ page }) => {
  const { user: admin } = await seedUser({ isAdmin: true });
  const { organisation } = await seedUser();

  const email = testEmail();

  await apiSignin({ page, email: admin.email });

  const target = { scope: 'ORGANISATION', organisationId: organisation.id } as const;

  const firstRes = await callCreateEmailSuppression(page, { email, target });
  expect(firstRes.ok()).toBeTruthy();

  const duplicateRes = await callCreateEmailSuppression(page, { email: email.toUpperCase(), target });
  expect(duplicateRes.status()).toBe(400);

  expect(await prisma.emailSuppression.count({ where: { email } })).toBe(1);
});
