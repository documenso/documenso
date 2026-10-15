import { currentMonthlyPeriod } from '@documenso/lib/universal/monthly-period';
import { prisma } from '@documenso/prisma';
import { seedPendingDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, type Page, test } from '@playwright/test';

import { waitForHydration } from '../fixtures/hydration';

const getEmailReports = async (organisationId: string) => {
  const stat = await prisma.organisationMonthlyStat.findUnique({
    where: {
      organisationId_period: {
        organisationId,
        period: currentMonthlyPeriod(),
      },
    },
    select: { emailReports: true },
  });

  return stat?.emailReports ?? 0;
};

const getUserDisabled = async (userId: number) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { disabled: true },
  });

  return user.disabled;
};

/**
 * Clicking the SSR rendered button before hydration is a no-op.
 */
const reportSender = async (page: Page, token: string) => {
  await page.goto(`/report/${token}`);

  await waitForHydration(page, 'button');

  await page.getByRole('button', { name: 'Report sender' }).click();
  await expect(page.getByRole('heading', { name: 'Sender reported' })).toBeVisible();
};

test('[REPORT_SENDER]: only reports the sender after the button is clicked', async ({ page }) => {
  const { user, team, organisation } = await seedUser();

  const document = await seedPendingDocument(user, team.id, ['recipient@documenso.com']);
  const token = document.recipients[0].token;

  expect(await getEmailReports(organisation.id)).toBe(0);

  await page.goto(`/report/${token}`);

  // Visiting the page (GET) must not register a report.
  await expect(page.getByRole('heading', { name: 'Report this sender?' })).toBeVisible();
  expect(await getEmailReports(organisation.id)).toBe(0);

  await reportSender(page, token);

  expect(await getEmailReports(organisation.id)).toBe(1);
});

test('[REPORT_SENDER]: does not double count within the rate limit window', async ({ page }) => {
  test.skip(process.env.DANGEROUS_BYPASS_RATE_LIMITS === 'true', 'Rate limits are bypassed');

  const { user, team, organisation } = await seedUser();

  const document = await seedPendingDocument(user, team.id, ['recipient@documenso.com']);
  const token = document.recipients[0].token;

  await reportSender(page, token);
  await reportSender(page, token);

  expect(await getEmailReports(organisation.id)).toBe(1);
});

/**
 * Every self-hosted organisation is on the free claim, so without the cloud gate a
 * single report would disable any self-hosted user.
 */
test('[REPORT_SENDER]: does not disable a reported free plan sender outside of Documenso Cloud', async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_IS_DOCUMENSO_CLOUD === 'true', 'Only applies outside Documenso Cloud');

  const { user, team } = await seedUser();

  const document = await seedPendingDocument(user, team.id, ['recipient@documenso.com']);
  const token = document.recipients[0].token;

  await reportSender(page, token);

  expect(await getUserDisabled(user.id)).toBe(false);

  await page.goto(`/sign/${token}`);
  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();
});

test('[REPORT_SENDER]: disables a reported free plan sender on Documenso Cloud', async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_IS_DOCUMENSO_CLOUD !== 'true', 'Only applies on Documenso Cloud');

  const { user, team } = await seedUser();

  const document = await seedPendingDocument(user, team.id, ['recipient@documenso.com']);
  const token = document.recipients[0].token;

  await reportSender(page, token);

  expect(await getUserDisabled(user.id)).toBe(true);

  await page.goto(`/sign/${token}`);
  await expect(page.getByRole('heading', { name: 'Sender Account Disabled' })).toBeVisible();
});

test('[REPORT_SENDER]: never disables an instance admin on Documenso Cloud', async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_IS_DOCUMENSO_CLOUD !== 'true', 'Only applies on Documenso Cloud');

  const { user, team } = await seedUser({ isAdmin: true });

  const document = await seedPendingDocument(user, team.id, ['recipient@documenso.com']);
  const token = document.recipients[0].token;

  await reportSender(page, token);

  expect(await getUserDisabled(user.id)).toBe(false);
});

test('[REPORT_SENDER]: returns 404 for an invalid token', async ({ page }) => {
  const response = await page.goto('/report/not-a-real-token');

  expect(response?.status()).toBe(404);
});
