import type { APIRequestContext, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { FieldType } from '@prisma/client';

import { apiSeedPendingDocument } from '../fixtures/api-seeds';
import { getCanvasBox, getPageCanvas } from '../fixtures/contents';
import { getKonvaNodeClientRectForPage, isKonvaNodeVisibleForPage } from '../fixtures/konva';

/**
 * A checked item draws its mark on top of its box. Konva only counts a click
 * when the press and the release land on the same shape, so a press on the
 * mark that slid off it before the release used to do nothing.
 */
test.describe('V2 envelope checkbox and radio signing', () => {
  test('a checked checkbox unchecks when pressed on its checkmark and released beside it', async ({
    page,
    request,
  }) => {
    const token = await seedChoiceFieldDocument(request, {
      type: FieldType.CHECKBOX,
      fieldMeta: {
        type: 'checkbox',
        values: [
          { id: 1, value: 'Check A', checked: false },
          { id: 2, value: 'Check B', checked: false },
        ],
      },
    });

    await openSigningPage(page, token);

    const square = await getKonvaNodeClientRectForPage(page, 1, '#checkbox-square-0');

    // The checkmark is drawn on a 16-unit grid with its corner at (7, 12). Its two strokes overlap
    // at (7, 11), which is wide enough to be hit at any sub-pixel alignment. (3, 3) is clear of both.
    const onCheckmark = { x: square.x + (7 / 16) * square.width, y: square.y + (11 / 16) * square.height };
    const besideCheckmark = { x: square.x + (3 / 16) * square.width, y: square.y + (3 / 16) * square.height };

    await getPageCanvas(page).click({ position: onCheckmark });
    await expect.poll(() => isKonvaNodeVisibleForPage(page, 1, '#checkbox-checkmark-0')).toBe(true);

    await pressAndRelease(page, onCheckmark, besideCheckmark);
    await expect.poll(() => isKonvaNodeVisibleForPage(page, 1, '#checkbox-checkmark-0')).toBe(false);
  });

  test('a selected radio option deselects when pressed on its dot and released beside it', async ({
    page,
    request,
  }) => {
    const token = await seedChoiceFieldDocument(request, {
      type: FieldType.RADIO,
      fieldMeta: {
        type: 'radio',
        values: [
          { id: 1, value: 'Option A', checked: false },
          { id: 2, value: 'Option B', checked: false },
        ],
      },
    });

    await openSigningPage(page, token);

    const circle = await getKonvaNodeClientRectForPage(page, 1, '#radio-circle-0');

    // The dot's radius is a quarter of the circle's width, so the second point is on the ring around it.
    const onDot = { x: circle.x + circle.width / 2, y: circle.y + circle.height / 2 };
    const besideDot = { x: onDot.x + 0.375 * circle.width, y: onDot.y };

    await getPageCanvas(page).click({ position: onDot });
    await expect.poll(() => isKonvaNodeVisibleForPage(page, 1, '#radio-dot-0')).toBe(true);

    await pressAndRelease(page, onDot, besideDot);
    await expect.poll(() => isKonvaNodeVisibleForPage(page, 1, '#radio-dot-0')).toBe(false);
  });
});

const seedChoiceFieldDocument = async (request: APIRequestContext, choiceField: ChoiceField) => {
  const { distributeResult } = await apiSeedPendingDocument(request, {
    recipients: [{ email: 'signer-choice@test.documenso.com', name: 'Choice Signer' }],
    fieldsPerRecipient: [
      [
        { type: FieldType.SIGNATURE, page: 1, positionX: 5, positionY: 5, width: 20, height: 5 },
        { ...choiceField, page: 1, positionX: 10, positionY: 25, width: 40, height: 12 },
      ],
    ],
  });

  return distributeResult.recipients[0].token;
};

const openSigningPage = async (page: Page, token: string) => {
  await page.goto(`/sign/${token}`);

  await expect(page.locator('img[data-page-number]').first()).toBeVisible({ timeout: 30_000 });
  await expect(getPageCanvas(page)).toBeVisible({ timeout: 30_000 });
};

const pressAndRelease = async (page: Page, press: CanvasPoint, release: CanvasPoint) => {
  const canvasBox = await getCanvasBox(page);

  await page.mouse.move(canvasBox.x + press.x, canvasBox.y + press.y);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + release.x, canvasBox.y + release.y);
  await page.mouse.up();
};

type ChoiceField = {
  type: FieldType;
  fieldMeta: Record<string, unknown>;
};

type CanvasPoint = {
  x: number;
  y: number;
};
