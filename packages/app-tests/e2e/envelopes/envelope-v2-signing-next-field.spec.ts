import { expect, type Page, test } from '@playwright/test';
import { FieldType } from '@prisma/client';

import { apiSeedPendingDocument } from '../fixtures/api-seeds';
import { openSigningPage, SIGNING_PDF_PAGE_SELECTOR } from '../fixtures/envelope-signing';

const HEADER_HEIGHT_PX = 64;

const SIGNATURE_FIELD = { type: FieldType.SIGNATURE, page: 1, positionX: 5, positionY: 75, width: 20, height: 5 };

const getMobileWidget = (page: Page) => page.locator('[data-signing-viewport-overlay]');

/**
 * The vertical extent of the field in the viewport, derived from the rendered page since
 * fields are drawn on a canvas.
 */
const getFieldViewportBounds = async (page: Page) => {
  const pageBox = await page.locator(SIGNING_PDF_PAGE_SELECTOR).first().boundingBox();

  if (!pageBox) {
    throw new Error('PDF page bounding box not found');
  }

  const top = pageBox.y + (SIGNATURE_FIELD.positionY / 100) * pageBox.height;

  return {
    top,
    bottom: top + (SIGNATURE_FIELD.height / 100) * pageBox.height,
  };
};

const getMobileWidgetTop = async (page: Page) => {
  const widgetBox = await getMobileWidget(page).boundingBox();

  if (!widgetBox) {
    throw new Error('Mobile widget bounding box not found');
  }

  return widgetBox.y;
};

test.describe('V2 envelope signing next field', () => {
  test('brings a field hidden behind the mobile bar into view', async ({ page, request }) => {
    // Short enough that the lower part of the first page sits behind the bottom bar.
    await page.setViewportSize({ width: 390, height: 500 });

    const { distributeResult } = await apiSeedPendingDocument(request, {
      recipients: [{ email: `next-field-${Date.now()}@test.documenso.com`, name: 'Next Field Signer' }],
      fieldsPerRecipient: [[SIGNATURE_FIELD]],
    });

    await openSigningPage(page, `/sign/${distributeResult.recipients[0].token}`);

    const boundsBefore = await getFieldViewportBounds(page);

    expect(boundsBefore.bottom).toBeGreaterThan(await getMobileWidgetTop(page));

    await getMobileWidget(page).getByRole('button', { name: 'Next Field', exact: true }).click();

    await expect(async () => {
      const { top, bottom } = await getFieldViewportBounds(page);

      expect(top).toBeGreaterThanOrEqual(HEADER_HEIGHT_PX);
      expect(bottom).toBeLessThanOrEqual(await getMobileWidgetTop(page));
    }).toPass({ timeout: 10_000 });
  });
});
