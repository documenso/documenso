import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { EmailSuppressionScope, EmailSuppressionSource } from '@prisma/client';

import { apiSignin } from '../../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

test('[ADMIN][EMAIL_SUPPRESSION]: an admin can add and remove a suppression', async ({ page }) => {
  const { user: admin } = await seedUser({ isAdmin: true });
  const { team } = await seedUser();

  const email = `suppressed-${nanoid(8)}@test.documenso.com`.toLowerCase();

  await apiSignin({ page, email: admin.email, redirectPath: '/admin/email-suppressions' });

  await page.getByRole('button', { name: 'Add suppression' }).click();

  const createDialog = page.getByRole('dialog');

  await createDialog.getByLabel('Email').fill(email);
  await createDialog.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Team', exact: true }).click();
  await createDialog.getByLabel('Team ID').fill(String(team.id));
  await createDialog.getByLabel('Reason').fill('Requested via support');
  await createDialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(createDialog).not.toBeVisible();

  await expect
    .poll(async () => prisma.emailSuppression.findFirst({ where: { email } }))
    .toMatchObject({
      scope: EmailSuppressionScope.TEAM,
      source: EmailSuppressionSource.ADMIN,
      teamId: team.id,
      reason: 'Requested via support',
    });

  await page.getByPlaceholder('Search by email, organisation, team or user').fill(email);

  const row = page.getByRole('row', { name: email });

  await expect(row).toContainText(team.name);

  await row.getByRole('button', { name: 'Remove' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();

  await expect.poll(async () => prisma.emailSuppression.count({ where: { email } })).toBe(0);
});
