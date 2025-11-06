import { type Page, expect, test } from '@playwright/test';
import path from 'path';

import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

const SINGLE_PLACEHOLDER_PDF_PATH = path.join(
  __dirname,
  '../../../assets/project-proposal-single-recipient.pdf',
);

const MULTIPLE_PLACEHOLDER_PDF_PATH = path.join(
  __dirname,
  '../../../assets/project-proposal-multiple-fields-and-recipients.pdf',
);

const setupUserAndSignIn = async (page: Page) => {
  const { user, team } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  return { user, team };
};

const uploadPdfAndContinue = async (page: Page, pdfPath: string, continueClicks: number = 1) => {
  const fileInput = page.locator('input[type="file"]').nth(1);
  await fileInput.waitFor({ state: 'attached' });
  await fileInput.setInputFiles(pdfPath);

  await page.waitForTimeout(3000);

  for (let i = 0; i < continueClicks; i++) {
    await page.getByRole('button', { name: 'Continue' }).click();
  }
};

test.describe('PDF Placeholders with single recipient', () => {
  test('[AUTO_PLACING_FIELDS]: should automatically create recipients from PDF placeholders', async ({
    page,
  }) => {
    await setupUserAndSignIn(page);
    await uploadPdfAndContinue(page, SINGLE_PLACEHOLDER_PDF_PATH, 1);

    await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();
    await expect(page.getByPlaceholder('Email')).toHaveValue('recipient.1@documenso.com');
    await expect(page.getByPlaceholder('Name')).toHaveValue('Recipient 1');
  });

  test('[AUTO_PLACING_FIELDS]: should automatically place fields from PDF placeholders', async ({
    page,
  }) => {
    await setupUserAndSignIn(page);
    await uploadPdfAndContinue(page, SINGLE_PLACEHOLDER_PDF_PATH, 2);

    await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

    await expect(page.locator('[data-field-type="SIGNATURE"]')).toBeVisible();
    await expect(page.locator('[data-field-type="EMAIL"]')).toBeVisible();
    await expect(page.locator('[data-field-type="NAME"]')).toBeVisible();
    await expect(page.locator('[data-field-type="TEXT"]')).toBeVisible();
  });

  test('[AUTO_PLACING_FIELDS]: should automatically configure fields from PDF placeholders', async ({
    page,
  }) => {
    await setupUserAndSignIn(page);
    await uploadPdfAndContinue(page, SINGLE_PLACEHOLDER_PDF_PATH, 2);

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

test.describe('PDF Placeholders with multiple recipients', () => {
  test('[AUTO_PLACING_FIELDS]: should automatically create recipients from PDF placeholders', async ({
    page,
  }) => {
    await setupUserAndSignIn(page);
    await uploadPdfAndContinue(page, MULTIPLE_PLACEHOLDER_PDF_PATH, 1);

    await expect(page.getByTestId('signer-email-input').first()).toHaveValue(
      'recipient.1@documenso.com',
    );
    await expect(page.getByLabel('Name').first()).toHaveValue('Recipient 1');

    await expect(page.getByTestId('signer-email-input').nth(1)).toHaveValue(
      'recipient.2@documenso.com',
    );
    await expect(page.getByLabel('Name').nth(1)).toHaveValue('Recipient 2');

    await expect(page.getByTestId('signer-email-input').nth(2)).toHaveValue(
      'recipient.3@documenso.com',
    );
    await expect(page.getByLabel('Name').nth(2)).toHaveValue('Recipient 3');
  });

  test('[AUTO_PLACING_FIELDS]: should automatically create fields from PDF placeholders', async ({
    page,
  }) => {
    await setupUserAndSignIn(page);
    await uploadPdfAndContinue(page, MULTIPLE_PLACEHOLDER_PDF_PATH, 2);

    await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

    await expect(page.locator('[data-field-type="SIGNATURE"]').first()).toBeVisible();
    await expect(page.locator('[data-field-type="SIGNATURE"]').nth(1)).toBeVisible();
    await expect(page.locator('[data-field-type="SIGNATURE"]').nth(2)).toBeVisible();
    await expect(page.locator('[data-field-type="EMAIL"]').first()).toBeVisible();
    await expect(page.locator('[data-field-type="EMAIL"]').nth(1)).toBeVisible();
    await expect(page.locator('[data-field-type="NAME"]')).toBeVisible();
    await expect(page.locator('[data-field-type="TEXT"]')).toBeVisible();
    await expect(page.locator('[data-field-type="NUMBER"]')).toBeVisible();
  });
});
