import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { createCanvas } from '@napi-rs/canvas';
import { expect, type Page, test } from '@playwright/test';

import {
  getContentActionButton,
  getContentGroupsForPage,
  getPageCanvas,
  getPageSize,
  placeContentOnPdf,
  selectEditorTab,
  waitForContentsAutosave,
} from '../fixtures/contents';
import {
  clickAddMyselfButton,
  clickEnvelopeEditorStep,
  getEnvelopeEditorSettingsTrigger,
  openDocumentEnvelopeEditor,
  openTemplateEnvelopeEditor,
  type TEnvelopeEditorSurface,
} from '../fixtures/envelope-editor';
import { expectToastTextToBeVisible } from '../fixtures/generic';

/**
 * The default box an image content is dropped at, as a percentage of the page.
 * Mirrors `CONTENT_IMAGE_DEFAULT_SIZE`.
 */
const IMAGE_DEFAULT_SIZE = { width: 15, height: 10 };

/**
 * Generate a solid color image of the given size in memory.
 */
const createImageFile = async (
  name: string,
  width: number,
  height: number,
  format: 'png' | 'jpeg' | 'webp' = 'png',
) => {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');

  context.fillStyle = 'rgb(30, 120, 220)';
  context.fillRect(0, 0, width, height);

  const buffer = format === 'png' ? await canvas.encode('png') : await canvas.encode(format);

  return { name, mimeType: `image/${format}`, buffer };
};

/**
 * A minimal GIF, which is a real image in a format the editor does not accept.
 */
const createGifFile = (name: string) => ({
  name,
  mimeType: 'image/gif',
  buffer: Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64'),
});

const openSettingsDialog = async (root: Page) => {
  await getEnvelopeEditorSettingsTrigger(root).click();
  await expect(root.getByRole('heading', { name: 'Document Settings' })).toBeVisible();
};

const updateExternalId = async (surface: TEnvelopeEditorSurface, externalId: string) => {
  await openSettingsDialog(surface.root);
  await surface.root.locator('input[name="externalId"]').fill(externalId);
  await surface.root.getByRole('button', { name: 'Update' }).click();
  await expectToastTextToBeVisible(surface.root, 'Envelope updated');
  await surface.root.getByTestId('toast-close').click();
};

const openContentsTab = async (surface: TEnvelopeEditorSurface, externalId: string) => {
  await updateExternalId(surface, externalId);
  await clickAddMyselfButton(surface.root);

  await clickEnvelopeEditorStep(surface.root, 'addFields');
  await expect(getPageCanvas(surface.root)).toBeVisible();

  await selectEditorTab(surface.root, 'Contents');
  await expect(surface.root.getByRole('heading', { name: 'Add Content' })).toBeVisible();
};

/**
 * The file input of the selected image content's settings panel. It is
 * always mounted while the content is selected, in both the empty and the
 * uploaded state.
 */
const getImageInput = (root: Page) => root.locator('input[id^="content-image-input-"]');

const uploadImage = async (root: Page, file: Awaited<ReturnType<typeof createImageFile>>) => {
  await getImageInput(root).setInputFiles({ name: file.name, mimeType: file.mimeType, buffer: file.buffer });
};

const findEnvelopeWithContents = async (surface: TEnvelopeEditorSurface, externalId: string) =>
  await prisma.envelope.findFirstOrThrow({
    where: {
      externalId,
      userId: surface.userId,
      teamId: surface.teamId,
      type: surface.envelopeType,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      contents: {
        include: {
          dataContent: true,
        },
      },
    },
  });

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const getMeta = (metadata: unknown): Record<string, unknown> => {
  if (!isRecord(metadata)) {
    throw new Error('Metadata is not an object');
  }

  return metadata;
};

// --- Upload, replace and remove ---

const runUploadReplaceRemoveFlow = async (surface: TEnvelopeEditorSurface) => {
  const externalId = `e2e-content-images-${nanoid()}`;
  const root = surface.root;

  await openContentsTab(surface, externalId);

  await placeContentOnPdf(root, 'Image', { x: 200, y: 200 });
  await expect(root.getByRole('heading', { name: 'Image Settings' })).toBeVisible();
  await expect(root.getByText('Click to upload or drag and drop')).toBeVisible();

  // The image content is a placeholder before upload.
  const [placeholder] = await getContentGroupsForPage(root);

  expect(placeholder.visibleChildren).toContain('content-placeholder-rect');

  // Upload a wide 2:1 image. The box is still the default size, so it is
  // sized to the image at one point per pixel.
  const wide = await createImageFile('wide-logo.png', 400, 200);

  await uploadImage(root, wide);

  await expect(root.getByText('wide-logo.png')).toBeVisible();
  await expect(root.getByText('400 * 200')).toBeVisible();

  const [withWide] = await getContentGroupsForPage(root);

  expect(withWide.visibleChildren).toContain('content-image');
  expect(withWide.visibleChildren).not.toContain('content-placeholder-rect');
  expect(withWide.rect.width / withWide.rect.height).toBeCloseTo(2, 1);

  await waitForContentsAutosave(surface);

  const afterUpload = await findEnvelopeWithContents(surface, externalId);
  const firstDataContentId = afterUpload.contents[0].dataContentId;

  expect(firstDataContentId).not.toBeNull();
  expect(getMeta(afterUpload.contents[0].dataContent?.metadata)).toMatchObject({
    type: 'image',
    width: 400,
    height: 200,
    mimeType: 'image/png',
    fileName: 'wide-logo.png',
  });

  // The box is no longer the default size, so replacing with a tall image
  // tightens the box around the fitted image rather than resizing to it.
  const tall = await createImageFile('tall-logo.jpg', 100, 300, 'jpeg');

  await uploadImage(root, tall);

  await expect(root.getByText('tall-logo.jpg')).toBeVisible();

  const [withTall] = await getContentGroupsForPage(root);

  expect(withTall.rect.width / withTall.rect.height).toBeCloseTo(1 / 3, 1);
  expect(withTall.rect.width).toBeLessThanOrEqual(withWide.rect.width + 0.5);
  expect(withTall.rect.height).toBeLessThanOrEqual(withWide.rect.height + 0.5);

  await waitForContentsAutosave(surface);

  const afterReplace = await findEnvelopeWithContents(surface, externalId);
  const secondDataContentId = afterReplace.contents[0].dataContentId;

  expect(secondDataContentId).not.toBeNull();
  expect(secondDataContentId).not.toBe(firstDataContentId);
  expect(getMeta(afterReplace.contents[0].dataContent?.metadata)).toMatchObject({
    mimeType: 'image/jpeg',
    fileName: 'tall-logo.jpg',
  });

  // The replaced image's data content was cleaned up.
  expect(await prisma.dataContent.findUnique({ where: { id: firstDataContentId ?? '' } })).toBeNull();

  // Remove returns to the drop zone and detaches the image, leaving the box.
  await root.getByRole('button', { name: 'Remove image' }).click();
  await expect(root.getByText('Click to upload or drag and drop')).toBeVisible();

  const [afterRemoveGroup] = await getContentGroupsForPage(root);

  expect(afterRemoveGroup.visibleChildren).toContain('content-placeholder-rect');
  expect(afterRemoveGroup.rect.width).toBeCloseTo(withTall.rect.width, 0);

  await waitForContentsAutosave(surface);

  const afterRemove = await findEnvelopeWithContents(surface, externalId);

  expect(afterRemove.contents[0].dataContentId).toBeNull();
  expect(await prisma.dataContent.findUnique({ where: { id: secondDataContentId ?? '' } })).toBeNull();

  return { externalId };
};

// --- Upload via the action bar, auto size caps ---

const runActionBarUploadFlow = async (surface: TEnvelopeEditorSurface) => {
  const externalId = `e2e-content-images-bar-${nanoid()}`;
  const root = surface.root;

  await openContentsTab(surface, externalId);

  await placeContentOnPdf(root, 'Image', { x: 200, y: 200 });
  await expect(getContentActionButton(root, 'Upload image')).toBeVisible();

  // The bar's button opens the same picker as the settings panel, so the
  // file can be set on that input directly after clicking it.
  const fileChooser = root.waitForEvent('filechooser');

  await getContentActionButton(root, 'Upload image').click();

  const huge = await createImageFile('huge-logo.png', 2000, 2000);

  await (await fileChooser).setFiles({ name: huge.name, mimeType: huge.mimeType, buffer: huge.buffer });

  await expect(root.getByText('huge-logo.png')).toBeVisible();
  await expect(getContentActionButton(root, 'Replace image')).toBeVisible();

  const pageSize = await getPageSize(root);

  await waitForContentsAutosave(surface);

  return { externalId, pageSize };
};

const assertActionBarUploadPersisted = async (
  surface: TEnvelopeEditorSurface,
  externalId: string,
  pageSize: { width: number; height: number },
) => {
  const envelope = await findEnvelopeWithContents(surface, externalId);
  const [imageContent] = envelope.contents;
  const meta = getMeta(imageContent.metadata);

  expect(imageContent.dataContent).not.toBeNull();

  // A 2000px square exceeds the page, so its width is capped at 80% of the
  // page width and the height follows the square ratio in page points, i.e.
  // 80% of the page width expressed as a percentage of the page height.
  expect(Number(meta.width)).toBeCloseTo(80, 0);
  expect(Number(meta.height)).toBeCloseTo((80 * pageSize.width) / pageSize.height, 0);
  expect(Number(meta.positionX) + Number(meta.width)).toBeLessThanOrEqual(100);
  expect(Number(meta.positionY) + Number(meta.height)).toBeLessThanOrEqual(100);
};

// --- Rejected uploads ---

const runRejectedUploadsFlow = async (surface: TEnvelopeEditorSurface) => {
  const externalId = `e2e-content-images-reject-${nanoid()}`;
  const root = surface.root;

  await openContentsTab(surface, externalId);

  await placeContentOnPdf(root, 'Image', { x: 200, y: 200 });

  // An unsupported format is rejected client side.
  await uploadImage(root, createGifFile('animated.gif'));
  await expect(root.getByText('This image could not be read. Use a PNG, JPEG or WebP file.')).toBeVisible();

  // Bytes which are not an image at all pass the type check and are rejected
  // by the server.
  await getImageInput(root).setInputFiles({
    name: 'not-an-image.png',
    mimeType: 'image/png',
    buffer: Buffer.from('definitely not a png'),
  });
  await expect(root.getByText('This image could not be read. Use a PNG, JPEG or WebP file.')).toBeVisible();

  // The placeholder is unaffected.
  const [group] = await getContentGroupsForPage(root);

  expect(group.visibleChildren).toContain('content-placeholder-rect');
  expect(IMAGE_DEFAULT_SIZE.width).toBeGreaterThan(0);

  await waitForContentsAutosave(surface);

  return { externalId };
};

const assertNoImageAttached = async (surface: TEnvelopeEditorSurface, externalId: string) => {
  const envelope = await findEnvelopeWithContents(surface, externalId);

  expect(envelope.contents).toHaveLength(1);
  expect(envelope.contents[0].dataContentId).toBeNull();
};

// --- Send guard ---

const runSendGuardFlow = async (surface: TEnvelopeEditorSurface) => {
  const externalId = `e2e-content-images-guard-${nanoid()}`;
  const root = surface.root;

  await openContentsTab(surface, externalId);

  await placeContentOnPdf(root, 'Image', { x: 200, y: 200 });

  // A signature field so the only thing blocking sending is the empty image.
  await selectEditorTab(root, 'Fields');
  await root.getByRole('button', { name: 'Signature', exact: true }).click();
  await getPageCanvas(root).click({ position: { x: 200, y: 500 } });

  await waitForContentsAutosave(surface);

  await root.getByRole('navigation').getByRole('button', { name: 'Send Document' }).click();
  await expect(root.getByRole('heading', { name: 'Send Document' })).toBeVisible();
  await expect(root.getByText(/image content(s)? (has|have) no image/)).toBeVisible();
  await expect(root.getByRole('button', { name: 'Send', exact: true })).toHaveCount(0);

  await root.keyboard.press('Escape');

  // Attach an image and the guard lifts.
  await selectEditorTab(root, 'Contents');
  await getPageCanvas(root).click({ position: { x: 200, y: 200 }, force: true });
  await expect(root.getByRole('heading', { name: 'Image Settings' })).toBeVisible();

  const logo = await createImageFile('logo.png', 120, 60);

  await uploadImage(root, logo);
  await expect(root.getByText('logo.png')).toBeVisible();

  await waitForContentsAutosave(surface);

  await root.getByRole('navigation').getByRole('button', { name: 'Send Document' }).click();
  await expect(root.getByRole('heading', { name: 'Send Document' })).toBeVisible();
  await expect(root.getByText(/image content(s)? (has|have) no image/)).toHaveCount(0);
  await expect(root.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
};

// --- Tests ---

test.describe('document editor', () => {
  test('upload, replace and remove a content image', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);

    await runUploadReplaceRemoveFlow(surface);
  });

  test('upload a content image from the canvas action bar', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const { externalId, pageSize } = await runActionBarUploadFlow(surface);

    await assertActionBarUploadPersisted(surface, externalId, pageSize);
  });

  test('rejected uploads leave the placeholder untouched', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const { externalId } = await runRejectedUploadsFlow(surface);

    await assertNoImageAttached(surface, externalId);
  });

  test('a document cannot be sent with an image content which has no image', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);

    await runSendGuardFlow(surface);
  });
});

test.describe('template editor', () => {
  test('upload, replace and remove a content image', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);

    await runUploadReplaceRemoveFlow(surface);
  });

  test('upload a content image from the canvas action bar', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const { externalId, pageSize } = await runActionBarUploadFlow(surface);

    await assertActionBarUploadPersisted(surface, externalId, pageSize);
  });

  test('rejected uploads leave the placeholder untouched', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const { externalId } = await runRejectedUploadsFlow(surface);

    await assertNoImageAttached(surface, externalId);
  });
});
