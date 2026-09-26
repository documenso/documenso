import { nanoid } from '@documenso/lib/universal/id';
import { expect, type Page, test } from '@playwright/test';

import { getPageCanvas, placeContentOnPdf, selectContentOnCanvas, selectEditorTab } from '../fixtures/contents';
import {
  clickAddMyselfButton,
  clickEnvelopeEditorStep,
  getEnvelopeEditorSettingsTrigger,
  openDocumentEnvelopeEditor,
  type TEnvelopeEditorSurface,
} from '../fixtures/envelope-editor';
import { expectToastTextToBeVisible } from '../fixtures/generic';
import { getKonvaTransformerNodeCountForPage } from '../fixtures/konva';

/**
 * Zooming destroys and rebuilds the page's Konva stage. The selection is held
 * as node references, so it has to be re-resolved against the rebuilt nodes,
 * otherwise the handles and the settings panel are lost mid-edit.
 */

const openContentsTab = async (surface: TEnvelopeEditorSurface) => {
  const root = surface.root;

  await getEnvelopeEditorSettingsTrigger(root).click();
  await expect(root.getByRole('heading', { name: 'Document Settings' })).toBeVisible();
  await root.locator('input[name="externalId"]').fill(`e2e-zoom-selection-${nanoid()}`);
  await root.getByRole('button', { name: 'Update' }).click();
  await expectToastTextToBeVisible(root, 'Envelope updated');
  await root.getByTestId('toast-close').click();

  await clickAddMyselfButton(root);

  await clickEnvelopeEditorStep(root, 'addFields');
  await expect(getPageCanvas(root)).toBeVisible();

  await selectEditorTab(root, 'Contents');
};

const zoomIn = async (root: Page) => await root.locator('button[title="Zoom in"]').click();

test('a selected field survives zooming', async ({ page }) => {
  const surface = await openDocumentEnvelopeEditor(page);
  const root = surface.root;

  await clickAddMyselfButton(root);
  await clickEnvelopeEditorStep(root, 'addFields');
  await expect(getPageCanvas(root)).toBeVisible();

  await root.getByRole('button', { name: 'Signature', exact: true }).click();
  await getPageCanvas(root).click({ position: { x: 160, y: 160 } });

  // A freshly placed field is auto selected, which deliberately suppresses
  // the action bar, so click it to make it a real selection.
  await selectContentOnCanvas(root, { x: 160, y: 160 });

  await expect.poll(() => getKonvaTransformerNodeCountForPage(root, 1)).toBe(1);
  await expect(root.getByTestId('envelope-canvas-action-bar')).toBeVisible();

  await zoomIn(root);

  // The rebuilt stage must end up with the same field selected.
  await expect.poll(() => getKonvaTransformerNodeCountForPage(root, 1)).toBe(1);

  // The action bar positions itself from the selected nodes, so it is only
  // placed correctly while they are the live ones.
  await expect(root.getByTestId('envelope-canvas-action-bar')).toBeVisible();
});

test('a selected content survives zooming', async ({ page }) => {
  const surface = await openDocumentEnvelopeEditor(page);
  const root = surface.root;

  await openContentsTab(surface);

  await placeContentOnPdf(root, 'Text', { x: 160, y: 160 });

  await selectContentOnCanvas(root, { x: 170, y: 170 });

  await expect.poll(() => getKonvaTransformerNodeCountForPage(root, 1)).toBe(1);
  await expect(root.getByTestId('envelope-canvas-action-bar')).toBeVisible();

  await zoomIn(root);

  await expect.poll(() => getKonvaTransformerNodeCountForPage(root, 1)).toBe(1);
  await expect(root.getByTestId('envelope-canvas-action-bar')).toBeVisible();
});
