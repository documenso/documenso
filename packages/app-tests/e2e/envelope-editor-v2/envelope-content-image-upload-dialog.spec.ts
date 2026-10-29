import { APP_CONTENT_IMAGE_UPLOAD_SIZE_LIMIT } from '@documenso/lib/constants/envelope-content';
import { megabytesToBytes } from '@documenso/lib/universal/unit-convertions';
import { prisma } from '@documenso/prisma';
import { createCanvas } from '@napi-rs/canvas';
import { expect, type FileChooser, type Page, test } from '@playwright/test';

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

/**
 * The upload dialog, including while it is hidden.
 *
 * While the native picker is open the dialog hides its content and shows only
 * its overlay. Role locators skip hidden elements unless told otherwise, so
 * without `includeHidden` an open dialog would look closed.
 */
const getUploadDialog = (page: Page) => page.getByRole('dialog', { includeHidden: true });

test('a dropped file which cannot be used shows why', async ({ page }) => {
  await openContentsEditor(page);

  await placeContentOnPdf(page, 'Image', { x: 200, y: 200 });

  const dropzoneInput = page
    .locator('div[role="button"]', { hasText: 'Click to upload or drag and drop' })
    .locator('input[type="file"]');

  // Not a supported image.
  await dropzoneInput.setInputFiles({
    name: 'animated.gif',
    mimeType: 'image/gif',
    buffer: Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64'),
  });

  await expect(page.getByText('This image could not be read. Use a PNG, JPEG or WebP file.')).toBeVisible();

  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Over the size limit.
  await dropzoneInput.setInputFiles({
    name: 'huge.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(megabytesToBytes(APP_CONTENT_IMAGE_UPLOAD_SIZE_LIMIT) + 1),
  });

  await expect(page.getByText(`This image is larger than ${APP_CONTENT_IMAGE_UPLOAD_SIZE_LIMIT} MB.`)).toBeVisible();
});

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
 * Dismissing the native picker closes the dialog, so picking again means
 * opening it again. That must start a fresh picker rather than reuse the
 * dismissed dialog's state.
 */
test('the picker can be reopened after being dismissed', async ({ page }) => {
  const surface = await openContentsEditor(page);

  await placeContentOnPdf(page, 'Image', { x: 200, y: 200 });
  await waitForContentsAutosave(surface);

  const dialog = getUploadDialog(page);

  // Nothing matches before the dialog opens, so what matches below is the
  // upload dialog rather than some other hidden dialog.
  await expect(dialog).toHaveCount(0);

  const firstChooser = page.waitForEvent('filechooser');

  await getContentActionButton(page, 'Upload image').click();
  await firstChooser;

  await expect(dialog).toHaveCount(1);

  // Playwright cannot dismiss a native picker, but the browser reports a
  // dismissal as a `cancel` event on the input.
  await page.locator('input[id^="content-image-input-"]').dispatchEvent('cancel');
  await expect(dialog).toHaveCount(0);

  const secondChooser = page.waitForEvent('filechooser');

  await getContentActionButton(page, 'Upload image').click();

  await (await secondChooser).setFiles({ name: 'logo.png', mimeType: 'image/png', buffer: await createPng() });

  await expect(getContentActionButton(page, 'Replace image')).toBeVisible();
});

/**
 * The drop area opens the upload dialog from the keyboard too. Only the
 * dialog's picker may open: the dropzone used to open its own picker as well,
 * so a keyboard user got two.
 */
for (const key of ['Enter', 'Space']) {
  test(`pressing ${key} on the drop area opens a single file picker`, async ({ page }) => {
    await openContentsEditor(page);

    await placeContentOnPdf(page, 'Image', { x: 200, y: 200 });

    const choosers: FileChooser[] = [];

    page.on('filechooser', (chooser) => choosers.push(chooser));

    await page.locator('div[role="button"]', { hasText: 'Click to upload or drag and drop' }).focus();
    await page.keyboard.press(key);

    // Give a second picker time to open, as it used to.
    await expect.poll(() => choosers.length).toBeGreaterThan(0);
    await page.waitForTimeout(1000);

    expect(choosers).toHaveLength(1);

    // The one picker is the upload dialog's, so the file goes through it.
    expect(await choosers[0].element().getAttribute('id')).toMatch(/^content-image-input-/);

    await choosers[0].setFiles({ name: 'logo.png', mimeType: 'image/png', buffer: await createPng() });

    await expect(getContentActionButton(page, 'Replace image')).toBeVisible();
  });
}

test('cancelling the picker closes the dialog', async ({ page }) => {
  const surface = await openContentsEditor(page);

  await placeContentOnPdf(page, 'Image', { x: 200, y: 200 });
  await waitForContentsAutosave(surface);

  const dialog = getUploadDialog(page);

  // Nothing matches before the dialog opens, so what matches below is the
  // upload dialog rather than some other hidden dialog.
  await expect(dialog).toHaveCount(0);

  const chooser = page.waitForEvent('filechooser');

  await getContentActionButton(page, 'Upload image').click();
  await chooser;

  // While the picker is open only the dialog's overlay shows, which still
  // blocks the editor. A trial click checks that without clicking.
  await expect(dialog).toHaveCount(1);
  await expect(getPageCanvas(page).click({ position: { x: 50, y: 50 }, trial: true, timeout: 1500 })).rejects.toThrow();

  // Playwright cannot dismiss a native picker, but the browser reports a
  // dismissal as a `cancel` event on the input, which is what the dialog
  // listens for.
  await page.locator('input[id^="content-image-input-"]').dispatchEvent('cancel');

  // The dialog is gone and the editor can be used again.
  await expect(dialog).toHaveCount(0);
  await getPageCanvas(page).click({ position: { x: 50, y: 50 }, trial: true });
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
