import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { createCanvas } from '@napi-rs/canvas';
import { expect, type Page, test } from '@playwright/test';

import {
  getContentActionButton,
  getContentCountForPage,
  getContentGroupsForPage,
  getPageCanvas,
  getPageSize,
  placeContentOnPdf,
  selectContentOnCanvas,
  selectEditorTab,
  waitForContentsAutosave,
} from '../fixtures/contents';
import {
  clickAddMyselfButton,
  clickEnvelopeEditorStep,
  getEnvelopeEditorSettingsTrigger,
  openDocumentEnvelopeEditor,
  type TEnvelopeEditorSurface,
} from '../fixtures/envelope-editor';
import { expectToastTextToBeVisible } from '../fixtures/generic';

/**
 * An image upload can finish after its content has been deleted. The late
 * result must be dropped, rather than writing the deleted content back over
 * whichever content took its place.
 */

const openContentsTab = async (surface: TEnvelopeEditorSurface) => {
  const root = surface.root;

  await getEnvelopeEditorSettingsTrigger(root).click();
  await expect(root.getByRole('heading', { name: 'Document Settings' })).toBeVisible();
  await root.locator('input[name="externalId"]').fill(`e2e-upload-race-${nanoid()}`);
  await root.getByRole('button', { name: 'Update' }).click();
  await expectToastTextToBeVisible(root, 'Envelope updated');
  await root.getByTestId('toast-close').click();

  await clickAddMyselfButton(root);

  await clickEnvelopeEditorStep(root, 'addFields');
  await expect(getPageCanvas(root)).toBeVisible();

  await selectEditorTab(root, 'Contents');
};

/**
 * Hold the image upload open so the content can be deleted while it is in
 * flight.
 */
const installImageUploadLag = async (page: Page, lagMs: number) => {
  let markInFlight: () => void = () => {};

  const uploadInFlight = new Promise<void>((resolve) => {
    markInFlight = resolve;
  });

  await page.route('**/api/files/upload-image', async (route) => {
    markInFlight();

    await new Promise((resolve) => setTimeout(resolve, lagMs));

    await route.continue();
  });

  return { uploadInFlight };
};

/**
 * The content being uploaded to can also survive but move, when a content
 * before it is deleted. The update is applied by index, so the new position
 * has to be resolved when the upload lands rather than when it started.
 */
test('an upload still lands on its own content when an earlier content is deleted', async ({ page }) => {
  const surface = await openDocumentEnvelopeEditor(page);
  const root = surface.root;

  const envelopeId = surface.envelopeId;

  if (!envelopeId) {
    throw new Error('Expected the document editor surface to have an envelopeId');
  }

  await openContentsTab(surface);

  // A text content first, then the image content which is uploaded to.
  await placeContentOnPdf(root, 'Text', { x: 150, y: 150 });
  await placeContentOnPdf(root, 'Image', { x: 150, y: 300 });

  await expect.poll(() => getContentCountForPage(root)).toBe(2);

  const [textContent, imageContent] = await getContentGroupsForPage(root);
  const { scale } = await getPageSize(root);

  await selectContentOnCanvas(root, {
    x: (imageContent.rect.x + 4) * scale,
    y: (imageContent.rect.y + 4) * scale,
  });

  const { uploadInFlight } = await installImageUploadLag(page, 5000);

  const png = await createCanvas(60, 30).encode('png');

  await root
    .locator('input[id^="content-image-input-"]')
    .setInputFiles({ name: 'image.png', mimeType: 'image/png', buffer: png });

  await uploadInFlight;

  // Delete the text content, which shifts the image content down a slot.
  await selectContentOnCanvas(root, {
    x: (textContent.rect.x + 4) * scale,
    y: (textContent.rect.y + 4) * scale,
  });

  await getContentActionButton(root, 'Remove').click();

  await expect.poll(() => getContentCountForPage(root)).toBe(1);

  await page.waitForTimeout(6000);
  await waitForContentsAutosave(surface);

  const contents = await prisma.envelopeContent.findMany({
    where: { envelopeId },
    select: { metadata: true, dataContentId: true },
  });

  expect(contents).toHaveLength(1);

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const metadata = contents[0].metadata as { type?: string };

  // The image content survived, and the upload landed on it.
  expect(metadata.type).toBe('image');
  expect(contents[0].dataContentId).not.toBeNull();
});

test('deleting an image content while its upload is in flight leaves other contents alone', async ({ page }) => {
  const surface = await openDocumentEnvelopeEditor(page);
  const root = surface.root;

  const envelopeId = surface.envelopeId;

  if (!envelopeId) {
    throw new Error('Expected the document editor surface to have an envelopeId');
  }

  await openContentsTab(surface);

  // The image content is placed first, so its slot is the one the text
  // content moves into once it is deleted.
  await placeContentOnPdf(root, 'Image', { x: 150, y: 150 });
  await placeContentOnPdf(root, 'Text', { x: 150, y: 300 });

  await expect.poll(() => getContentCountForPage(root)).toBe(2);

  const [imageContent] = await getContentGroupsForPage(root);
  const { scale } = await getPageSize(root);

  await selectContentOnCanvas(root, {
    x: (imageContent.rect.x + 4) * scale,
    y: (imageContent.rect.y + 4) * scale,
  });

  const { uploadInFlight } = await installImageUploadLag(page, 5000);

  const png = await createCanvas(60, 30).encode('png');

  await root
    .locator('input[id^="content-image-input-"]')
    .setInputFiles({ name: 'image.png', mimeType: 'image/png', buffer: png });

  await uploadInFlight;

  await getContentActionButton(root, 'Remove').click();

  await expect.poll(() => getContentCountForPage(root)).toBe(1);

  // Let the upload land, then let the editor save.
  await page.waitForTimeout(6000);
  await waitForContentsAutosave(surface);

  // The deleted image content must not have come back, and the text content
  // must still be there untouched.
  await expect.poll(() => getContentCountForPage(root)).toBe(1);

  const contents = await prisma.envelopeContent.findMany({
    where: { envelopeId },
    select: { metadata: true, dataContentId: true },
  });

  expect(contents).toHaveLength(1);

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const metadata = contents[0].metadata as { type?: string };

  expect(metadata.type).toBe('text');
  expect(contents[0].dataContentId).toBeNull();
});
