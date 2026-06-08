import { currentMonthlyPeriod } from '@documenso/lib/universal/monthly-period';
import { prisma } from '@documenso/prisma';
import { seedPendingDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';

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

test('[REPORT_SENDER]: only reports the sender after the button is clicked', async ({ page }) => {
  const { user, team, organisation } = await seedUser();

  const document = await seedPendingDocument(user, team.id, ['recipient@documenso.com']);
  const token = document.recipients[0].token;

  expect(await getEmailReports(organisation.id)).toBe(0);

  await page.goto(`/report/${token}`);

  // Visiting the page (GET) must not register a report.
  await expect(page.getByRole('heading', { name: 'Report this sender?' })).toBeVisible();
  expect(await getEmailReports(organisation.id)).toBe(0);

  await page.getByRole('button', { name: 'Report sender' }).click();

  await expect(page.getByRole('heading', { name: 'Sender reported' })).toBeVisible();

  expect(await getEmailReports(organisation.id)).toBe(1);
});

test('[REPORT_SENDER]: does not double count within the rate limit window', async ({ page }) => {
  test.skip(process.env.DANGEROUS_BYPASS_RATE_LIMITS === 'true', 'Rate limits are bypassed');

  const { user, team, organisation } = await seedUser();

  const document = await seedPendingDocument(user, team.id, ['recipient@documenso.com']);
  const token = document.recipients[0].token;

  await page.goto(`/report/${token}`);
  await page.getByRole('button', { name: 'Report sender' }).click();
  await expect(page.getByRole('heading', { name: 'Sender reported' })).toBeVisible();

  await page.goto(`/report/${token}`);
  await page.getByRole('button', { name: 'Report sender' }).click();
  await expect(page.getByRole('heading', { name: 'Sender reported' })).toBeVisible();

  expect(await getEmailReports(organisation.id)).toBe(1);
});

test('[REPORT_SENDER]: returns 404 for an invalid token', async ({ page }) => {
  const response = await page.goto('/report/not-a-real-token');

  expect(response?.status()).toBe(404);
});
