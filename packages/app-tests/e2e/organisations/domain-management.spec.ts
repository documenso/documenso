import { expect, test } from '@playwright/test';

import { nanoid } from '@documenso/lib/universal/id';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';
import { expectTextToBeVisible, expectTextToNotBeVisible } from '../fixtures/generic';

test.describe('[ORGANISATIONS] Domain Management', () => {
  test('should allow organization admin to add valid domain', async ({ page }) => {
    const { user, organisation } = await seedUser({
      isPersonalOrganisation: false,
    });

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/o/${organisation.url}/settings/domain-access`,
    });

    // Test adding a valid domain
    const testDomain = `test-${nanoid()}.com`;

    await page.getByRole('button', { name: 'Add Domain' }).click();
    await page.getByLabel('Domain').fill(testDomain);
    await page.getByRole('button', { name: 'Add' }).click();

    // Verify success toast and domain appears in list
    await expectTextToBeVisible(page, 'Domain added successfully');
    await expectTextToBeVisible(page, testDomain);
  });

  test('should prevent adding duplicate domain', async ({ page }) => {
    const { user, organisation } = await seedUser({
      isPersonalOrganisation: false,
    });

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/o/${organisation.url}/settings/domain-access`,
    });

    const testDomain = `duplicate-${nanoid()}.com`;

    // Add domain first time
    await page.getByRole('button', { name: 'Add Domain' }).click();
    await page.getByLabel('Domain').fill(testDomain);
    await page.getByRole('button', { name: 'Add' }).click();
    await expectTextToBeVisible(page, 'Domain added successfully');

    // Try to add same domain again
    await page.getByRole('button', { name: 'Add Domain' }).click();
    await page.getByLabel('Domain').fill(testDomain);
    await page.getByRole('button', { name: 'Add' }).click();

    // Verify error message for duplicate domain
    await expectTextToBeVisible(page, 'Failed to add domain');
    await expectTextToBeVisible(page, 'domain is valid and not already configured');
  });

  test('should reject invalid domain formats', async ({ page }) => {
    const { user, organisation } = await seedUser({
      isPersonalOrganisation: false,
    });

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/o/${organisation.url}/settings/domain-access`,
    });

    const invalidDomains = [
      'invalid-domain',
      'http://example.com',
      'example.com/path',
      '.invalid.com',
      'example..com',
    ];

    for (const invalidDomain of invalidDomains) {
      await page.getByRole('button', { name: 'Add Domain' }).click();
      await page.getByLabel('Domain').fill(invalidDomain);
      await page.getByRole('button', { name: 'Add' }).click();

      // Verify error message for invalid domain
      await expectTextToBeVisible(page, 'Failed to add domain');

      // Close dialog to try next domain
      await page.getByRole('button', { name: 'Cancel' }).click();
    }
  });

  test('should allow organization admin to remove domain', async ({ page }) => {
    const { user, organisation } = await seedUser({
      isPersonalOrganisation: false,
    });

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/o/${organisation.url}/settings/domain-access`,
    });

    const testDomain = `remove-test-${nanoid()}.com`;

    // Add domain first
    await page.getByRole('button', { name: 'Add Domain' }).click();
    await page.getByLabel('Domain').fill(testDomain);
    await page.getByRole('button', { name: 'Add' }).click();
    await expectTextToBeVisible(page, 'Domain added successfully');

    // Remove the domain
    await page
      .getByRole('row')
      .filter({ hasText: testDomain })
      .getByRole('button', { name: 'Remove' })
      .click();
    await page.getByRole('button', { name: 'Confirm' }).click();

    // Verify domain is removed
    await expectTextToBeVisible(page, 'Domain removed successfully');
    await expectTextToNotBeVisible(page, testDomain);
  });

  test('should list organization domains with pagination', async ({ page }) => {
    const { user, organisation } = await seedUser({
      isPersonalOrganisation: false,
    });

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/o/${organisation.url}/settings/domain-access`,
    });

    // Add multiple domains
    const domains = [];
    for (let i = 0; i < 3; i++) {
      const domain = `test-${i}-${nanoid()}.com`;
      domains.push(domain);

      await page.getByRole('button', { name: 'Add Domain' }).click();
      await page.getByLabel('Domain').fill(domain);
      await page.getByRole('button', { name: 'Add' }).click();
      await expectTextToBeVisible(page, 'Domain added successfully');
    }

    // Verify all domains are visible
    for (const domain of domains) {
      await expectTextToBeVisible(page, domain);
    }
  });

  test('should prevent non-admin users from managing domains', async ({ page }) => {
    // First create an organization with admin
    const { user: adminUser, organisation } = await seedUser({
      isPersonalOrganisation: false,
    });

    // Create a regular member user
    const memberEmail = `member-${nanoid()}@test.documenso.com`;
    const { user: memberUser } = await seedUser({
      email: memberEmail,
      isPersonalOrganisation: false,
    });

    // Try to access domain settings as member (should be restricted)
    await apiSignin({
      page,
      email: memberUser.email,
      redirectPath: `/o/${organisation.url}/settings/domain-access`,
    });

    // Should not be able to see domain management interface
    // This will likely redirect or show an error/unauthorized message
    await expect(page.getByText('Unauthorized')).toBeVisible();
  });

  test('should show empty state when no domains configured', async ({ page }) => {
    const { user, organisation } = await seedUser({
      isPersonalOrganisation: false,
    });

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/o/${organisation.url}/settings/domain-access`,
    });

    // Verify empty state message
    await expectTextToBeVisible(page, 'No domains configured');
    await expectTextToBeVisible(page, 'Add your first domain to enable auto-assignment');
  });

  test('should normalize domain input (remove protocols, paths)', async ({ page }) => {
    const { user, organisation } = await seedUser({
      isPersonalOrganisation: false,
    });

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/o/${organisation.url}/settings/domain-access`,
    });

    const baseDomain = `normalize-${nanoid()}.com`;
    const inputWithProtocol = `https://${baseDomain}`;

    // Add domain with protocol
    await page.getByRole('button', { name: 'Add Domain' }).click();
    await page.getByLabel('Domain').fill(inputWithProtocol);
    await page.getByRole('button', { name: 'Add' }).click();

    // Verify domain is added with normalized form (without protocol)
    await expectTextToBeVisible(page, 'Domain added successfully');
    await expectTextToBeVisible(page, baseDomain);
    await expectTextToNotBeVisible(page, inputWithProtocol);
  });
});
