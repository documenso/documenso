import { expect, test } from '@playwright/test';

import { apiSeedPendingDocument } from '../fixtures/api-seeds';

const PDF_PAGE_SELECTOR = 'img[data-page-number]';

const LONG_NAME = 'Maximilian Montgomery-Fitzgerald';
const FULL_FONT_SIZE = 72;

test('[TYPED_SIGNATURE]: long names shrink to fit the type pad and short names stay large', async ({
  page,
  request,
}) => {
  const { distributeResult } = await apiSeedPendingDocument(request, {
    recipients: [{ email: `long-name-${Date.now()}@test.documenso.com`, name: LONG_NAME }],
  });

  await page.goto(`/sign/${distributeResult.recipients[0].token}`);

  await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

  await page.getByTestId('signature-pad-dialog-button').click();
  await page.getByRole('tab', { name: 'Type' }).click();

  const input = page.getByTestId('signature-pad-type-input');

  const getHiddenOverflow = () => input.evaluate((el) => el.scrollWidth - el.clientWidth);
  const getFontSize = () => input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

  await expect(input).toHaveValue(LONG_NAME);
  await expect.poll(getHiddenOverflow).toBe(0);

  const fontSizeBeforeResize = await getFontSize();

  expect(fontSizeBeforeResize).toBeLessThan(FULL_FONT_SIZE);

  await page.setViewportSize({ width: 480, height: 1200 });

  await expect.poll(getFontSize).toBeLessThan(fontSizeBeforeResize);
  await expect.poll(getHiddenOverflow).toBe(0);

  await input.fill('Jo Doe');

  await expect.poll(getFontSize).toBe(FULL_FONT_SIZE);
});
