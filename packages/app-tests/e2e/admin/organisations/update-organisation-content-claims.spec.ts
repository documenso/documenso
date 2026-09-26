import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';

import { apiSignin } from '../../fixtures/authentication';
import { expectToastTextToBeVisible } from '../../fixtures/generic';

test('[ADMIN]: update envelope content claims for an organisation', async ({ page }) => {
  const { user: adminUser } = await seedUser({
    isAdmin: true,
  });

  const { organisation } = await seedUser({
    isPersonalOrganisation: false,
  });

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/admin/organisations/${organisation.id}`,
  });

  await expect(page.getByText('Manage organisation')).toBeVisible();

  const contentCountInput = page.getByLabel('Envelope Content Count', { exact: true });
  const imageCountInput = page.getByLabel('Envelope Content Image Count', { exact: true });

  // Everything is unlimited by default.
  await expect(contentCountInput).toHaveValue('0');
  await expect(imageCountInput).toHaveValue('0');

  await contentCountInput.fill('25');
  await imageCountInput.fill('5');

  // "Update role" buttons also match a non-exact name.
  await page.getByRole('button', { name: 'Update', exact: true }).last().click();

  await expectToastTextToBeVisible(page, 'Organisation has been updated successfully');

  await expect(async () => {
    const claim = await prisma.organisationClaim.findFirstOrThrow({
      where: { organisation: { id: organisation.id } },
    });

    expect(claim.envelopeContentCount).toBe(25);
    expect(claim.envelopeContentImageCount).toBe(5);
  }).toPass({ timeout: 10000 });

  // The saved values are shown when the page is loaded again.
  await page.reload();

  await expect(page.getByLabel('Envelope Content Count', { exact: true })).toHaveValue('25');
  await expect(page.getByLabel('Envelope Content Image Count', { exact: true })).toHaveValue('5');
});
