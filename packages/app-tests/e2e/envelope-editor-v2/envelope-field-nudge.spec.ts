import { expect, type Page, test } from '@playwright/test';
import type Konva from 'konva';

import { clickAddMyselfButton, clickEnvelopeEditorStep, openDocumentEnvelopeEditor } from '../fixtures/envelope-editor';

const getFieldRect = async (page: Page) =>
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const konva: typeof Konva = (window as unknown as { Konva: typeof Konva }).Konva;
    const stage = konva.stages.find((stage) => stage.attrs.id === 'page-1');
    const rect = stage?.find('.field-group')[0].getClientRect({ skipStroke: true, skipShadow: true });

    return { x: rect?.x ?? 0, y: rect?.y ?? 0 };
  });

const openEditorWithSelectedField = async (page: Page) => {
  await openDocumentEnvelopeEditor(page);
  await clickAddMyselfButton(page);
  await clickEnvelopeEditorStep(page, 'addFields');

  const canvas = page.locator('.konva-container canvas').first();

  await expect(canvas).toBeVisible();
  await page.getByRole('button', { name: 'Signature', exact: true }).click();
  await canvas.click({ position: { x: 200, y: 200 } });

  await expect.poll(async () => (await getFieldRect(page)).x).toBeGreaterThan(0);
};

test.describe('field arrow key nudge', () => {
  test('arrow keys move the selected field 1px and Shift+Arrow 10px', async ({ page }) => {
    await openEditorWithSelectedField(page);

    const start = await getFieldRect(page);

    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await getFieldRect(page)).x - start.x).toBeCloseTo(1, 0);

    await page.keyboard.press('ArrowDown');
    await expect.poll(async () => (await getFieldRect(page)).y - start.y).toBeCloseTo(1, 0);

    await page.keyboard.press('Shift+ArrowLeft');
    await expect.poll(async () => (await getFieldRect(page)).x - start.x).toBeCloseTo(-9, 0);

    await page.keyboard.press('Shift+ArrowUp');
    await expect.poll(async () => (await getFieldRect(page)).y - start.y).toBeCloseTo(-9, 0);
  });

  test('field stops at the page edge', async ({ page }) => {
    await openEditorWithSelectedField(page);

    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Shift+ArrowLeft');
    }

    await expect.poll(async () => (await getFieldRect(page)).x).toBeCloseTo(0, 0);
  });
});
