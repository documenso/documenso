import { expect, type Page, test } from '@playwright/test';
import type Konva from 'konva';

import {
  getPageCanvas,
  interactWithCanvasPastActionBar,
  placeContentOnPdf,
  selectEditorTab,
} from '../fixtures/contents';
import { clickAddMyselfButton, clickEnvelopeEditorStep, openDocumentEnvelopeEditor } from '../fixtures/envelope-editor';
import { getKonvaTransformerNodeCountForPage } from '../fixtures/konva';

/**
 * A selected item's resize handles reach a little into the item, so they are
 * easy to grab. Pressing and releasing one without dragging used to count as
 * a click on the empty page, which deselected the item.
 */

const getCanvasBox = async (page: Page) => {
  const box = await getPageCanvas(page).boundingBox();

  if (!box) {
    throw new Error('The page canvas is not rendered');
  }

  return box;
};

/**
 * Press and release the selection's bottom middle resize handle without
 * moving, just inside the selected item.
 */
const clickResizeHandle = async (page: Page) => {
  const handle = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const konva: typeof Konva = (window as unknown as { Konva: typeof Konva }).Konva;

    const anchor = konva.stages.find((stage) => stage.attrs.id === 'page-1')?.findOne('.bottom-center');

    if (!anchor) {
      throw new Error('The selection has no bottom middle resize handle');
    }

    const rect = anchor.getClientRect();

    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });

  const canvas = await getCanvasBox(page);

  await interactWithCanvasPastActionBar(page, async () => {
    await page.mouse.move(canvas.x + handle.x + 10, canvas.y + handle.y - 5);
    await page.mouse.down();
    await page.mouse.up();
  });
};

const expectSelectionKept = async (page: Page) => {
  // Nothing should change, so give anything which would deselect a moment.
  await page.waitForTimeout(500);

  expect(await getKonvaTransformerNodeCountForPage(page, 1)).toBe(1);
};

/**
 * An empty area of the page still deselects.
 */
const expectEmptyClickDeselects = async (page: Page) => {
  const canvas = await getCanvasBox(page);

  await page.mouse.click(canvas.x + 400, canvas.y + 700);

  await expect.poll(async () => await getKonvaTransformerNodeCountForPage(page, 1)).toBe(0);
};

test('clicking a content resize handle without dragging keeps the content selected', async ({ page }) => {
  await openDocumentEnvelopeEditor(page);
  await clickEnvelopeEditorStep(page, 'addFields');
  await expect(getPageCanvas(page)).toBeVisible();
  await selectEditorTab(page, 'Contents');

  // A newly placed content is selected.
  await placeContentOnPdf(page, 'Text', { x: 160, y: 160 });
  await expect.poll(async () => await getKonvaTransformerNodeCountForPage(page, 1)).toBe(1);

  await clickResizeHandle(page);
  await expectSelectionKept(page);

  await expectEmptyClickDeselects(page);
});

test('clicking a field resize handle without dragging keeps the field selected', async ({ page }) => {
  await openDocumentEnvelopeEditor(page);
  await clickAddMyselfButton(page);
  await clickEnvelopeEditorStep(page, 'addFields');
  await expect(getPageCanvas(page)).toBeVisible();

  // A newly placed field is selected.
  await page.getByRole('button', { name: 'Signature', exact: true }).click();
  await getPageCanvas(page).click({ position: { x: 160, y: 160 } });
  await expect.poll(async () => await getKonvaTransformerNodeCountForPage(page, 1)).toBe(1);

  await clickResizeHandle(page);
  await expectSelectionKept(page);

  await expectEmptyClickDeselects(page);
});
