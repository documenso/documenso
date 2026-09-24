import { expect, test } from '@playwright/test';

import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

test('[BRANDING_LOGO_SIZE]: can save different logo sizes for team', async ({ page }) => {
  const { user, team } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings/branding`,
  });

  // Wait for the page to fully load and heading to be visible
  await expect(page.getByRole('heading', { name: 'Branding Preferences' })).toBeVisible();
  await expect(page.getByTestId('enable-branding')).toBeVisible();

  // Enable branding first - it's a Select dropdown, not a switch
  await page.getByTestId('enable-branding').click();
  await page.getByRole('option', { name: 'Yes' }).first().click();

  // Wait for the dropdown to close and form to settle
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

    // Wait for dropdown to open
    await page.waitForTimeout(200);

    // Select the size option (exact match for Large and others)
    await page.getByRole('option', { name: size.label, exact: true }).click();

    // Wait for dropdown to close
    await page.waitForTimeout(300);

    // Verify the selection is shown
    await expect(page.locator('button').filter({ hasText: size.label }).first()).toBeVisible();

    // Wait for the Update button to be ready
    const updateButton = page.getByRole('button', { name: 'Update' });
    await expect(updateButton).toBeEnabled();

    // Submit the form
    await updateButton.click();

    // Wait for button to become disabled (form is submitting)
    await expect(updateButton).toBeDisabled({ timeout: 5000 });

    // Wait for button to become enabled again (form submission complete)
    await expect(updateButton).toBeEnabled({ timeout: 15000 });

    // Now check for the success toast
    try {
      await expect(
        page.locator('[role="status"]').getByText('Branding preferences updated'),
      ).toBeVisible({
        timeout: 3000,
      });
    } catch (err) {
      // If success toast not found, check for error toast
      const errorToast = page.locator('[role="status"]').getByText('Something went wrong');
      if (await errorToast.isVisible()) {
        throw new Error('Form submission failed with error toast');
      }
      throw err;
    }

    // Wait for toast to disappear and form to reset
    await page.waitForTimeout(1500);
  }
});

test('[BRANDING_LOGO_SIZE]: logo size dropdown is disabled when branding is not enabled', async ({
  page,
}) => {
  const { user, team } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings/branding`,
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

test('[BRANDING_LOGO_SIZE]: logo size persists after page reload', async ({ page }) => {
  const { user, team } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings/branding`,
  });

  // Wait for the page to fully load and heading to be visible
  await expect(page.getByRole('heading', { name: 'Branding Preferences' })).toBeVisible();
  await expect(page.getByTestId('enable-branding')).toBeVisible();

  // Enable branding
  await page.getByTestId('enable-branding').click();
  await page.getByRole('option', { name: 'Yes' }).first().click();

  // Select logo size - find button in Logo Size field
  const logoSizeLabel = page.getByText('Logo Size');
  const logoSizeButton = logoSizeLabel.locator('..').locator('button').first();
  await logoSizeButton.click();
  await page.waitForTimeout(200);

  await page.getByRole('option', { name: 'Large', exact: true }).click();
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
  await expect(page.locator('button').filter({ hasText: 'Large' }).first()).toBeVisible();
});

test('[BRANDING_LOGO_SIZE]: can switch between different logo sizes', async ({ page }) => {
  const { user, team } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings/branding`,
  });

  // Wait for the page to fully load and heading to be visible
  await expect(page.getByRole('heading', { name: 'Branding Preferences' })).toBeVisible();
  await expect(page.getByTestId('enable-branding')).toBeVisible();

  // Enable branding
  await page.getByTestId('enable-branding').click();
  await page.getByRole('option', { name: 'Yes' }).first().click();
  await page.waitForTimeout(500);

  // Start with Small
  const logoSizeLabelStart = page.getByText('Logo Size');
  const logoSizeButtonStart = logoSizeLabelStart.locator('..').locator('button').first();
  await logoSizeButtonStart.click();
  await page.waitForTimeout(200);

  await page.getByRole('option', { name: 'Small' }).click();
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

  // Switch to Large
  const logoSizeLabelSwitch = page.getByText('Logo Size');
  const logoSizeButtonSwitch = logoSizeLabelSwitch.locator('..').locator('button').first();
  await logoSizeButtonSwitch.click();
  await page.waitForTimeout(200);

  await page.getByRole('option', { name: 'Large', exact: true }).click();
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

  // Reload and verify it's Large
  await page.reload();
  await expect(page.locator('button').filter({ hasText: 'Large' }).first()).toBeVisible();
});
