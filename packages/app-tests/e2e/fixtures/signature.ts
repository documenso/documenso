import type { Page } from '@playwright/test';

/**
 * Will open the signature pad dialog and sign it.
 */
export const signSignaturePad = async (page: Page) => {
  await page.waitForTimeout(200);

  await page.getByTestId('signature-pad-dialog-button').click();

  // Click type tab
  await page.getByRole('tab', { name: 'Type' }).click();
  await page.getByTestId('signature-pad-type-input').fill('Signature');

  // Click Next button
  await page.getByRole('button', { name: 'Next' }).click();
};

/**
 * For when the signature pad is already open.
 */
export const signDirectSignaturePad = async (page: Page) => {
  await page.waitForTimeout(200);

  // Click type tab
  await page.getByRole('tab', { name: 'Type' }).click();
  await page.getByTestId('signature-pad-type-input').fill('Signature');
};
