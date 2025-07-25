import { expect, test } from '@playwright/test';

import { nanoid } from '@documenso/lib/universal/id';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';
import { expectTextToBeVisible, expectTextToNotBeVisible } from '../fixtures/generic';

test.describe('[ORGANISATIONS] Domain UI Integration', () => {
  test('should show and hide domain add dialog correctly', async ({ page }) => {
    const { user, organisation } = await seedUser({
      isPersonalOrganisation: false,
    });

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/o/${organisation.url}/settings/domain-access`,
    });

    // Dialog should not be visible initially
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Click to open dialog
    await page.getByRole('button', { name: 'Add Domain' }).click();

    // Dialog should now be visible
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectTextToBeVisible(page, 'Add Domain');
    await expect(page.getByLabel('Domain')).toBeVisible();

    // Cancel should close dialog
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('should validate domain input in real-time', async ({ page }) => {
    const { user, organisation } = await seedUser({
      isPersonalOrganisation: false,
    });

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/o/${organisation.url}/settings/domain-access`,
    });

    await page.getByRole('button', { name: 'Add Domain' }).click();

    // Test empty input
    await page.getByRole('button', { name: 'Add' }).click();
    await expectTextToBeVisible(page, 'Domain is required');

    // Test invalid format
    await page.getByLabel('Domain').fill('invalid-domain');
    await page.getByRole('button', { name: 'Add' }).click();
    await expectTextToBeVisible(page, 'Please enter a valid domain');

    // Test valid domain should not show error
    await page.getByLabel('Domain').clear();
    await page.getByLabel('Domain').fill(`valid-${nanoid()}.com`);
    // Error message should disappear
    await expectTextToNotBeVisible(page, 'Please enter a valid domain');
  });

  test('should display success notification after adding domain', async ({ page }) => {
    const { user, organisation } = await seedUser({
      isPersonalOrganisation: false,
    });

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/o/${organisation.url}/settings/domain-access`,
    });

    const testDomain = `success-test-${nanoid()}.com`;

    await page.getByRole('button', { name: 'Add Domain' }).click();
    await page.getByLabel('Domain').fill(testDomain);
    await page.getByRole('button', { name: 'Add' }).click();

    // Success toast should appear
    await expectTextToBeVisible(page, 'Domain added successfully');
    await expectTextToBeVisible(
      page,
      'The domain has been added to your organisation and new users with matching email addresses will be automatically assigned.',
    );

    // Dialog should close automatically
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Domain should appear in the list
    await expectTextToBeVisible(page, testDomain);
  });

  test('should display error notification for duplicate domain', async ({ page }) => {
    const { user, organisation } = await seedUser({
      isPersonalOrganisation: false,
    });

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/o/${organisation.url}/settings/domain-access`,
    });

    const testDomain = `duplicate-ui-${nanoid()}.com`;

    // Add domain first time
    await page.getByRole('button', { name: 'Add Domain' }).click();
    await page.getByLabel('Domain').fill(testDomain);
    await page.getByRole('button', { name: 'Add' }).click();
    await expectTextToBeVisible(page, 'Domain added successfully');

    // Try to add same domain again
    await page.getByRole('button', { name: 'Add Domain' }).click();
    await page.getByLabel('Domain').fill(testDomain);
    await page.getByRole('button', { name: 'Add' }).click();

    // Error toast should appear
    await expectTextToBeVisible(page, 'Failed to add domain');
    await expectTextToBeVisible(
      page,
      'There was an error adding the domain. Please check that the domain is valid and not already configured.',
    );

    // Dialog should remain open for user to correct
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should show confirmation dialog before removing domain', async ({ page }) => {
    const { user, organisation } = await seedUser({
      isPersonalOrganisation: false,
    });

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/o/${organisation.url}/settings/domain-access`,
    });

    const testDomain = `remove-ui-${nanoid()}.com`;

    // Add domain first
    await page.getByRole('button', { name: 'Add Domain' }).click();
    await page.getByLabel('Domain').fill(testDomain);
    await page.getByRole('button', { name: 'Add' }).click();
    await expectTextToBeVisible(page, 'Domain added successfully');

    // Click remove button
    await page
      .getByRole('row')
      .filter({ hasText: testDomain })
      .getByRole('button', { name: 'Remove' })
      .click();

    // Confirmation dialog should appear
    await expectTextToBeVisible(page, 'Are you sure you want to remove this domain?');
    await expectTextToBeVisible(
      page,
      'This action cannot be undone and will stop auto-assignment for this domain.',
    );

    // Should have confirm and cancel buttons
    await expect(page.getByRole('button', { name: 'Confirm' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

    // Cancel should close dialog without removing
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expectTextToBeVisible(page, testDomain); // Domain still exists
  });

  test('should show loading states during add/remove operations', async ({ page }) => {
    const { user, organisation } = await seedUser({
      isPersonalOrganisation: false,
    });

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/o/${organisation.url}/settings/domain-access`,
    });

    const testDomain = `loading-test-${nanoid()}.com`;

    // Test loading state during add
    await page.getByRole('button', { name: 'Add Domain' }).click();
    await page.getByLabel('Domain').fill(testDomain);

    // Click add and immediately check for loading state
    const addPromise = page.getByRole('button', { name: 'Add' }).click();

    // Button should show loading state
    await expect(page.getByRole('button', { name: 'Adding...' })).toBeVisible();

    await addPromise;
    await expectTextToBeVisible(page, 'Domain added successfully');

    // Test loading state during remove
    await page
      .getByRole('row')
      .filter({ hasText: testDomain })
      .getByRole('button', { name: 'Remove' })
      .click();

    const removePromise = page.getByRole('button', { name: 'Confirm' }).click();

    // Button should show loading state
    await expect(page.getByRole('button', { name: 'Removing...' })).toBeVisible();

    await removePromise;
    await expectTextToBeVisible(page, 'Domain removed successfully');
  });

  test('should clear form after successful domain addition', async ({ page }) => {
    const { user, organisation } = await seedUser({
      isPersonalOrganisation: false,
    });

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/o/${organisation.url}/settings/domain-access`,
    });

    const testDomain = `form-clear-${nanoid()}.com`;

    await page.getByRole('button', { name: 'Add Domain' }).click();
    await page.getByLabel('Domain').fill(testDomain);
    await page.getByRole('button', { name: 'Add' }).click();

    await expectTextToBeVisible(page, 'Domain added successfully');

    // Open dialog again to check if form is cleared
    await page.getByRole('button', { name: 'Add Domain' }).click();

    // Domain input should be empty
    await expect(page.getByLabel('Domain')).toHaveValue('');
  });

  test('should display domain list with proper formatting', async ({ page }) => {
    const { user, organisation } = await seedUser({
      isPersonalOrganisation: false,
    });

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/o/${organisation.url}/settings/domain-access`,
    });

    const testDomain = `formatting-${nanoid()}.com`;

    await page.getByRole('button', { name: 'Add Domain' }).click();
    await page.getByLabel('Domain').fill(testDomain);
    await page.getByRole('button', { name: 'Add' }).click();
    await expectTextToBeVisible(page, 'Domain added successfully');

    // Check table structure
    await expect(page.getByRole('columnheader', { name: 'Domain' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Added' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();

    // Check domain row
    const domainRow = page.getByRole('row').filter({ hasText: testDomain });
    await expect(domainRow).toBeVisible();
    await expect(domainRow.getByRole('cell').first()).toContainText(testDomain);
    await expect(domainRow.getByRole('button', { name: 'Remove' })).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    const { user, organisation } = await seedUser({
      isPersonalOrganisation: false,
    });

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/o/${organisation.url}/settings/domain-access`,
    });

    // Simulate network failure by intercepting the API call
    await page.route('**/api/trpc/organisation.domain.add*', (route) => {
      route.abort('failed');
    });

    const testDomain = `network-error-${nanoid()}.com`;

    await page.getByRole('button', { name: 'Add Domain' }).click();
    await page.getByLabel('Domain').fill(testDomain);
    await page.getByRole('button', { name: 'Add' }).click();

    // Should show error message
    await expectTextToBeVisible(page, 'Failed to add domain');
    await expectTextToBeVisible(page, 'There was an error adding the domain');

    // Dialog should remain open
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should show conditional rendering based on permissions', async ({ page }) => {
    const { user, organisation } = await seedUser({
      isPersonalOrganisation: false,
    });

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/o/${organisation.url}/settings/domain-access`,
    });

    // Admin should see all controls
    await expect(page.getByRole('button', { name: 'Add Domain' })).toBeVisible();

    // If there are domains, remove buttons should be visible
    const testDomain = `permission-${nanoid()}.com`;
    await page.getByRole('button', { name: 'Add Domain' }).click();
    await page.getByLabel('Domain').fill(testDomain);
    await page.getByRole('button', { name: 'Add' }).click();
    await expectTextToBeVisible(page, 'Domain added successfully');

    await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible();
  });

  test('should refresh domain list after operations', async ({ page }) => {
    const { user, organisation } = await seedUser({
      isPersonalOrganisation: false,
    });

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/o/${organisation.url}/settings/domain-access`,
    });

    // Start with empty state
    await expectTextToBeVisible(page, 'No domains configured');

    // Add domain
    const testDomain = `refresh-${nanoid()}.com`;
    await page.getByRole('button', { name: 'Add Domain' }).click();
    await page.getByLabel('Domain').fill(testDomain);
    await page.getByRole('button', { name: 'Add' }).click();
    await expectTextToBeVisible(page, 'Domain added successfully');

    // Empty state should be gone
    await expectTextToNotBeVisible(page, 'No domains configured');
    await expectTextToBeVisible(page, testDomain);

    // Remove domain
    await page
      .getByRole('row')
      .filter({ hasText: testDomain })
      .getByRole('button', { name: 'Remove' })
      .click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expectTextToBeVisible(page, 'Domain removed successfully');

    // Should return to empty state
    await expectTextToBeVisible(page, 'No domains configured');
    await expectTextToNotBeVisible(page, testDomain);
  });
});
