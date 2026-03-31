import { expect, test } from '@playwright/test';

import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

test('[BRANDING_LOGO_SIZE]: can save different logo sizes for organization', async ({ page }) => {
  const { user, organisation } = await seedUser({
    roles: {
      organisationRole: 'ADMIN',
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/settings/branding`,
  });

  // Wait for the page to fully load and heading to be visible
  await expect(page.getByRole('heading', { name: 'Branding Preferences' })).toBeVisible();
  await expect(page.getByTestId('enable-branding')).toBeVisible();

  // Enable branding first - it's a Select dropdown, not a switch
  await page.getByTestId('enable-branding').click();
  await page.getByRole('option', { name: 'Yes' }).first().click();
  await page.waitForTimeout(500);

  // Test each logo size option
  const logoSizes = [
    { value: 'h-6', label: 'Small' },
    { value: 'h-8', label: 'Medium' },
    { value: 'h-12', label: 'Large' },
    { value: 'h-16', label: 'Extra large' },
  ];

  for (const size of logoSizes) {
    // Click the logo size select - find the button in the Logo Size field
    const logoSizeLabel = page.getByText('Logo Size');
    const logoSizeButton = logoSizeLabel.locator('..').locator('button').first();
    await logoSizeButton.click();
    await page.waitForTimeout(200);

    // Select the size option (exact match for Large to avoid matching Extra large)
    await page.getByRole('option', { name: size.label, exact: size.label === 'Large' }).click();
    await page.waitForTimeout(300);

    // Verify the selection is shown
    await expect(page.locator('button').filter({ hasText: size.label }).first()).toBeVisible();

    // Submit the form
    const updateButton = page.getByRole('button', { name: 'Update' });
    await expect(updateButton).toBeEnabled();
    await updateButton.click();

    // Wait for button to become disabled (form is submitting)
    await expect(updateButton).toBeDisabled({ timeout: 5000 });

    // Wait for button to become enabled again (form submission complete)
    await expect(updateButton).toBeEnabled({ timeout: 15000 });

    // Verify success toast
    await expect(
      page.locator('[role="status"]').getByText('Branding preferences updated'),
    ).toBeVisible({
      timeout: 3000,
    });

    // Small delay to ensure toast is dismissed before next iteration
    await page.waitForTimeout(1500);
  }
});

test('[BRANDING_LOGO_SIZE]: organization logo size persists after page reload', async ({
  page,
}) => {
  const { user, organisation } = await seedUser({
    roles: {
      organisationRole: 'ADMIN',
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/settings/branding`,
  });

  // Wait for the page to fully load and heading to be visible
  await expect(page.getByRole('heading', { name: 'Branding Preferences' })).toBeVisible();
  await expect(page.getByTestId('enable-branding')).toBeVisible();

  // Enable branding
  await page.getByTestId('enable-branding').click();
  await page.getByRole('option', { name: 'Yes' }).first().click();
  await page.waitForTimeout(500);

  // Select logo size - Extra large
  const logoSizeLabel = page.getByText('Logo Size');
  const logoSizeButton = logoSizeLabel.locator('..').locator('button').first();
  await logoSizeButton.click();
  await page.waitForTimeout(200);

  await page.getByRole('option', { name: 'Extra large' }).click();
  await page.waitForTimeout(300);

  // Update
  const updateButton = page.getByRole('button', { name: 'Update' });
  await expect(updateButton).toBeEnabled();
  await updateButton.click();

  // Wait for button to become disabled (form is submitting)
  await expect(updateButton).toBeDisabled({ timeout: 5000 });

  // Wait for button to become enabled again (form submission complete)
  await expect(updateButton).toBeEnabled({ timeout: 15000 });

  // Verify success toast
  await expect(
    page.locator('[role="status"]').getByText('Branding preferences updated'),
  ).toBeVisible({
    timeout: 3000,
  });

  // Wait for toast to disappear
  await page.waitForTimeout(1500);

  // Reload the page
  await page.reload();

  // Verify the logo size is still selected
  await expect(page.locator('button').filter({ hasText: 'Extra large' }).first()).toBeVisible();
});

test('[BRANDING_LOGO_SIZE]: organization logo size dropdown is disabled when branding is not enabled', async ({
  page,
}) => {
  const { user, organisation } = await seedUser({
    roles: {
      organisationRole: 'ADMIN',
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/settings/branding`,
  });

  // Wait for the page to fully load and heading to be visible
  await expect(page.getByRole('heading', { name: 'Branding Preferences' })).toBeVisible();
  await expect(page.getByTestId('enable-branding')).toBeVisible();

  // Find the logo size select button - navigate from the Label
  const logoSizeLabel = page.getByText('Logo Size');
  const firstButton = logoSizeLabel.locator('..').locator('button').first();
  await expect(firstButton).toBeDisabled();

  // Enable branding
  await page.getByTestId('enable-branding').click();
  await page.getByRole('option', { name: 'Yes' }).first().click();

  // Now the button should be enabled
  await expect(firstButton).toBeEnabled();

  // Disable branding again
  await page.getByTestId('enable-branding').click();
  await page.getByRole('option', { name: 'No' }).first().click();

  // Button should be disabled again
  await expect(firstButton).toBeDisabled();
});

test('[BRANDING_LOGO_SIZE]: can switch between different organization logo sizes', async ({
  page,
}) => {
  const { user, organisation } = await seedUser({
    roles: {
      organisationRole: 'ADMIN',
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/settings/branding`,
  });

  // Wait for the page to fully load and heading to be visible
  await expect(page.getByRole('heading', { name: 'Branding Preferences' })).toBeVisible();
  await expect(page.getByTestId('enable-branding')).toBeVisible();

  // Enable branding
  await page.getByTestId('enable-branding').click();
  await page.getByRole('option', { name: 'Yes' }).first().click();
  await page.waitForTimeout(500);

  // Start with Medium
  const logoSizeLabelStart = page.getByText('Logo Size');
  const logoSizeButtonStart = logoSizeLabelStart.locator('..').locator('button').first();
  await logoSizeButtonStart.click();
  await page.waitForTimeout(200);

  await page.getByRole('option', { name: 'Medium' }).click();
  await page.waitForTimeout(300);

  const updateButtonFirst = page.getByRole('button', { name: 'Update' });
  await expect(updateButtonFirst).toBeEnabled();
  await updateButtonFirst.click();

  // Wait for button to become disabled (form is submitting)
  await expect(updateButtonFirst).toBeDisabled({ timeout: 5000 });

  // Wait for button to become enabled again (form submission complete)
  await expect(updateButtonFirst).toBeEnabled({ timeout: 15000 });

  // Verify success toast
  await expect(
    page.locator('[role="status"]').getByText('Branding preferences updated'),
  ).toBeVisible({
    timeout: 3000,
  });
  await page.waitForTimeout(1000);

  // Switch to Extra large
  const logoSizeLabelSwitch = page.getByText('Logo Size');
  const logoSizeButtonSwitch = logoSizeLabelSwitch.locator('..').locator('button').first();
  await logoSizeButtonSwitch.click();
  await page.waitForTimeout(200);

  await page.getByRole('option', { name: 'Extra large' }).click();
  await page.waitForTimeout(300);

  const updateButtonSecond = page.getByRole('button', { name: 'Update' });
  await expect(updateButtonSecond).toBeEnabled();
  await updateButtonSecond.click();

  // Wait for button to become disabled (form is submitting)
  await expect(updateButtonSecond).toBeDisabled({ timeout: 5000 });

  // Wait for button to become enabled again (form submission complete)
  await expect(updateButtonSecond).toBeEnabled({ timeout: 15000 });

  // Verify success toast
  await expect(
    page.locator('[role="status"]').getByText('Branding preferences updated'),
  ).toBeVisible({
    timeout: 3000,
  });
  await page.waitForTimeout(1000);

  // Reload and verify it's Extra large
  await page.reload();
  await expect(page.locator('button').filter({ hasText: 'Extra large' }).first()).toBeVisible();
});
