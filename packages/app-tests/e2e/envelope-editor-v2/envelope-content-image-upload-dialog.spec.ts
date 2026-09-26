import { prisma } from '@documenso/prisma';
import { createCanvas } from '@napi-rs/canvas';
import { expect, type Page, test } from '@playwright/test';

import {
  getContentActionButton,
  getContentGroupsForPage,
  getPageCanvas,
  placeContentOnPdf,
  selectEditorTab,
  waitForContentsAutosave,
} from '../fixtures/contents';
import { clickEnvelopeEditorStep, openDocumentEnvelopeEditor } from '../fixtures/envelope-editor';

test.use({ storageState: { cookies: [], origins: [] } });

/**
 * Image uploads go through a dialog which blocks the editor until the upload
 * settles, so there is only ever one in flight and it always lands on the
 * content it was opened for.
 */

const createPng = async () => {
  const canvas = createCanvas(80, 40);
  const context = canvas.getContext('2d');

  context.fillStyle = 'rgb(30, 120, 220)';
  context.fillRect(0, 0, 80, 40);

  return await canvas.encode('png');
};

const openContentsEditor = async (page: Page) => {
  const surface = await openDocumentEnvelopeEditor(page);

  await clickEnvelopeEditorStep(page, 'addFields');
  await selectEditorTab(page, 'Contents');

  return surface;
};

/**
 * Click Upload / Replace on the action bar and hand the picker a file.
 */
const uploadThroughDialog = async (page: Page, buffer: Buffer) => {
  const fileChooser = page.waitForEvent('filechooser');

  await getContentActionButton(page, 'Upload image').or(getContentActionButton(page, 'Replace image')).click();

  await (await fileChooser).setFiles({ name: 'logo.png', mimeType: 'image/png', buffer });
};

test('the dialog blocks the editor while an image uploads', async ({ page }) => {
  const surface = await openContentsEditor(page);

  await placeContentOnPdf(page, 'Image', { x: 200, y: 200 });
  await waitForContentsAutosave(surface);

  // Hold the upload open so the blocked state is observable.
  let releaseUpload: () => void = () => {};
  const uploadHeld = new Promise<void>((resolve) => {
    releaseUpload = resolve;
  });

  await page.route('**/api/trpc/envelope.content.uploadImage**', async (route) => {
    await uploadHeld;
    await route.continue();
  });

  await uploadThroughDialog(page, await createPng());

  await expect(page.getByTestId('content-image-uploading')).toBeVisible();

  // The dialog's overlay intercepts pointer events, so a normal click on the
  // canvas cannot be performed.
  await expect(getPageCanvas(page).click({ position: { x: 50, y: 50 }, timeout: 1500 })).rejects.toThrow();
  await expect(page.getByTestId('content-image-uploading')).toBeVisible();

  // Escape does not dismiss it either.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('content-image-uploading')).toBeVisible();

  releaseUpload();

  await expect(page.getByTestId('content-image-uploading')).toHaveCount(0);
  await expect(getContentActionButton(page, 'Replace image')).toBeVisible();
});

test('the upload lands on the content it was opened for', async ({ page }) => {
  const surface = await openContentsEditor(page);

  await placeContentOnPdf(page, 'Image', { x: 150, y: 150 });
  await placeContentOnPdf(page, 'Image', { x: 350, y: 350 });
  await waitForContentsAutosave(surface);

  // The second placed content is the selected one.
  await uploadThroughDialog(page, await createPng());

  await expect(getContentActionButton(page, 'Replace image')).toBeVisible();

  const groups = await getContentGroupsForPage(page);
  const withImage = groups.filter((group) => group.visibleChildren.includes('content-image'));

  expect(withImage).toHaveLength(1);

  // And it is persisted on that content, not the other.
  const contents = await prisma.envelopeContent.findMany({
    where: { envelopeId: surface.envelopeId },
  });

  const byStackingOrder = [...contents].sort((a, b) => a.contentMeta.zIndex - b.contentMeta.zIndex);

  expect(byStackingOrder.map((content) => content.dataContentId !== null)).toEqual([false, true]);
});

/**
 * Dismissing the native picker leaves the dialog open on its "Choose image"
 * button. Pressing that must reopen the picker even though the dialog's
 * state has not changed.
 */
test('the picker can be reopened from the dialog after being dismissed', async ({ page }) => {
  const surface = await openContentsEditor(page);

  await placeContentOnPdf(page, 'Image', { x: 200, y: 200 });
  await waitForContentsAutosave(surface);

  // Open the picker and leave it unanswered: the dialog stays on "picking".
  const firstChooser = page.waitForEvent('filechooser');

  await getContentActionButton(page, 'Upload image').click();
  await firstChooser;

  await expect(page.getByRole('button', { name: 'Choose image' })).toBeVisible();

  // Pressing the dialog's button opens a fresh picker.
  const secondChooser = page.waitForEvent('filechooser');

  await page.getByRole('button', { name: 'Choose image' }).click();

  await (await secondChooser).setFiles({ name: 'logo.png', mimeType: 'image/png', buffer: await createPng() });

  await expect(getContentActionButton(page, 'Replace image')).toBeVisible();
});

test('cancelling the picker closes the dialog', async ({ page }) => {
  const surface = await openContentsEditor(page);

  await placeContentOnPdf(page, 'Image', { x: 200, y: 200 });
  await waitForContentsAutosave(surface);

  const chooser = page.waitForEvent('filechooser');

  await getContentActionButton(page, 'Upload image').click();
  await chooser;

  await expect(page.getByRole('dialog')).toBeVisible();

  // Playwright cannot dismiss a native picker, but the browser reports a
  // dismissal as a `cancel` event on the input, which is what the dialog
  // listens for.
  await page.locator('input[id^="content-image-input-"]').dispatchEvent('cancel');

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(getContentActionButton(page, 'Upload image')).toBeVisible();
});

test('a content placed and uploaded before autosave still receives its image', async ({ page }) => {
  const surface = await openContentsEditor(page);

  // No waitForContentsAutosave: the content has no server id yet when the
  // upload is requested. The dialog flushes the save before uploading.
  await placeContentOnPdf(page, 'Image', { x: 200, y: 200 });

  await uploadThroughDialog(page, await createPng());

  await expect(getContentActionButton(page, 'Replace image')).toBeVisible();

  const content = await prisma.envelopeContent.findFirstOrThrow({ where: { envelopeId: surface.envelopeId } });

  expect(content.dataContentId).not.toBeNull();
});
