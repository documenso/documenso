import { expect, test } from '@playwright/test';
import path from 'path';

import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

const PLACEHOLDER_PDF_PATH = path.join(
  __dirname,
  '../../../assets/project-proposal-single-recipient.pdf',
);
test.describe('PDF Placeholders with single recipient', () => {
  test('[AUTO_PLACING_FIELDS]: should automatically create recipients from PDF placeholders', async ({
    page,
  }) => {
    const { user, team } = await seedUser();

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    const fileInput = page.locator('input[type="file"]').nth(1);
    await fileInput.waitFor({ state: 'attached' });
    await fileInput.setInputFiles(PLACEHOLDER_PDF_PATH);

    await page.waitForTimeout(3000);

    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();
    await expect(page.getByPlaceholder('Email')).toHaveValue('recipient.1@documenso.com');
    await expect(page.getByPlaceholder('Name')).toHaveValue('Recipient 1');
  });

  test('[AUTO_PLACING_FIELDS]: should automatically place fields from PDF placeholders', async ({
    page,
  }) => {
    const { user, team } = await seedUser();

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    const fileInput = page.locator('input[type="file"]').nth(1);
    await fileInput.waitFor({ state: 'attached' });
    await fileInput.setInputFiles(PLACEHOLDER_PDF_PATH);

    await page.waitForTimeout(3000);

    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

    await expect(page.locator('[data-field-type="SIGNATURE"]')).toBeVisible();
    await expect(page.locator('[data-field-type="EMAIL"]')).toBeVisible();
    await expect(page.locator('[data-field-type="NAME"]')).toBeVisible();
    await expect(page.locator('[data-field-type="TEXT"]')).toBeVisible();
  });

  test('[AUTO_PLACING_FIELDS]: should automatically configure fields from PDF placeholders', async ({
    page,
  }) => {
    const { user, team } = await seedUser();

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    const fileInput = page.locator('input[type="file"]').nth(1);
    await fileInput.waitFor({ state: 'attached' });
    await fileInput.setInputFiles(PLACEHOLDER_PDF_PATH);

    await page.waitForTimeout(3000);

    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.getByText('Text').nth(1).click();
    await page.getByRole('button', { name: 'Advanced settings' }).click();

    await expect(page.getByRole('heading', { name: 'Advanced settings' })).toBeVisible();
    await expect(
      page
        .locator('div')
        .filter({ hasText: /^Required field$/ })
        .getByRole('switch'),
    ).toBeChecked();

    await expect(page.getByRole('combobox')).toHaveText('Right');
  });
});
