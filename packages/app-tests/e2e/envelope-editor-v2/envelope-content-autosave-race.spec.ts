import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { createCanvas } from '@napi-rs/canvas';
import { expect, type Page, test } from '@playwright/test';

import {
  getContentActionButton,
  getContentGroupsForPage,
  getPageCanvas,
  getPageSize,
  interactWithCanvasPastActionBar,
  placeContentOnPdf,
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
 * Editing a content while its first save is still on the wire must not make
 * the server delete and recreate the row, which used to happen on every save
 * from then on because the client kept the id of the deleted row.
 */

const CONTENT_SET_PROCEDURE = 'envelope.content.set';

/**
 * Hold the first `envelope.content.set` open so an edit can be made while it
 * is in flight. Later saves are forwarded immediately.
 */
const installContentSetLag = async (page: Page, lagMs: number) => {
  let markFirstInFlight: () => void = () => {};

  const firstContentSetInFlight = new Promise<void>((resolve) => {
    markFirstInFlight = resolve;
  });

  const requestBodies: string[] = [];

  await page.route('**/api/trpc/**', async (route) => {
    const request = route.request();

    if (request.method() !== 'POST' || !request.url().includes(CONTENT_SET_PROCEDURE)) {
      await route.continue();
      return;
    }

    const callIndex = requestBodies.length + 1;
    requestBodies.push(request.postData() ?? '');

    if (callIndex === 1) {
      markFirstInFlight();

      await new Promise((resolve) => setTimeout(resolve, lagMs));
    }

    await route.continue();
  });

  return { firstContentSetInFlight, requestBodies };
};

const openContentsTab = async (surface: TEnvelopeEditorSurface) => {
  const root = surface.root;

  await getEnvelopeEditorSettingsTrigger(root).click();
  await expect(root.getByRole('heading', { name: 'Document Settings' })).toBeVisible();
  await root.locator('input[name="externalId"]').fill(`e2e-content-race-${nanoid()}`);
  await root.getByRole('button', { name: 'Update' }).click();
  await expectToastTextToBeVisible(root, 'Envelope updated');
  await root.getByTestId('toast-close').click();

  await clickAddMyselfButton(root);

  await clickEnvelopeEditorStep(root, 'addFields');
  await expect(getPageCanvas(root)).toBeVisible();

  await selectEditorTab(root, 'Contents');
};

const getContentRows = async (envelopeId: string) =>
  await prisma.envelopeContent.findMany({
    where: { envelopeId },
    select: { id: true, metadata: true },
  });

/**
 * Drag the only content on the page by the given offset.
 */
const dragContent = async (root: Page, offsetX: number, offsetY: number) => {
  const [content] = await getContentGroupsForPage(root);
  const { scale } = await getPageSize(root);

  const box = await getPageCanvas(root).boundingBox();

  if (!box) {
    throw new Error('Canvas bounding box not available');
  }

  const startX = box.x + (content.rect.x + content.rect.width / 2) * scale;
  const startY = box.y + (content.rect.y + content.rect.height / 2) * scale;

  await interactWithCanvasPastActionBar(root, async () => {
    await root.mouse.move(startX, startY);
    await root.mouse.down();
    await root.mouse.move(startX + offsetX, startY + offsetY, { steps: 8 });
    await root.mouse.up();
  });
};

/**
 * The same race on an image content, which used to be the worst case: the
 * recreated row left the editor pointing at a data content the server had
 * cleaned up, so every later save failed.
 */
test('editing a duplicated image content mid-save keeps saving', async ({ page }) => {
  const surface = await openDocumentEnvelopeEditor(page);
  const root = surface.root;

  const envelopeId = surface.envelopeId;

  if (!envelopeId) {
    throw new Error('Expected the document editor surface to have an envelopeId');
  }

  await openContentsTab(surface);

  await placeContentOnPdf(root, 'Image', { x: 150, y: 150 });

  const png = await createCanvas(60, 30).encode('png');

  await root
    .locator('input[id^="content-image-input-"]')
    .setInputFiles({ name: 'image.png', mimeType: 'image/png', buffer: png });

  await waitForContentsAutosave(surface);
  await expect.poll(async () => (await getContentRows(envelopeId)).length).toBe(1);

  const { firstContentSetInFlight } = await installContentSetLag(page, 4000);

  // Duplicating clones the image server side, so the response carries a
  // different data content id than was sent.
  await getContentActionButton(root, 'Duplicate').click();

  await firstContentSetInFlight;

  await dragContent(root, 50, 30);

  await waitForContentsAutosave(surface);

  // A further edit must still save cleanly.
  await dragContent(root, -20, 15);
  await waitForContentsAutosave(surface);

  await expect(root.getByText('Save failed')).toHaveCount(0);

  const rows = await prisma.envelopeContent.findMany({
    where: { envelopeId },
    select: { id: true, dataContentId: true },
  });

  expect(rows).toHaveLength(2);

  // Both contents keep their own image, and neither points at a deleted row.
  const dataContentIds = rows.flatMap((row) => (row.dataContentId ? [row.dataContentId] : []));

  expect(new Set(dataContentIds).size).toBe(2);

  const dataContents = await prisma.dataContent.findMany({ where: { id: { in: dataContentIds } } });

  expect(dataContents).toHaveLength(2);
});

/**
 * Whatever the cause, if the editor ends up holding an ID the envelope no
 * longer has, the server treats the content as new and the editor has to
 * adopt the ID it gets back. Keeping the old one would make every later save
 * create yet another row.
 */
test('a content whose row no longer exists recovers on the next save', async ({ page }) => {
  const surface = await openDocumentEnvelopeEditor(page);
  const root = surface.root;

  const envelopeId = surface.envelopeId;

  if (!envelopeId) {
    throw new Error('Expected the document editor surface to have an envelopeId');
  }

  await openContentsTab(surface);

  await placeContentOnPdf(root, 'Text', { x: 150, y: 150 });
  await waitForContentsAutosave(surface);

  await expect.poll(async () => (await getContentRows(envelopeId)).length).toBe(1);

  // Drop the row behind the editor's back, so the ID it holds is stale.
  await prisma.envelopeContent.deleteMany({ where: { envelopeId } });

  await dragContent(root, 40, 30);
  await waitForContentsAutosave(surface);

  const recreated = await getContentRows(envelopeId);

  expect(recreated).toHaveLength(1);

  // The editor must now be pointing at the recreated row, so a further edit
  // updates it instead of creating a third one.
  await dragContent(root, -20, 10);
  await waitForContentsAutosave(surface);

  const rowsAfterEdit = await getContentRows(envelopeId);

  expect(rowsAfterEdit).toHaveLength(1);
  expect(rowsAfterEdit[0].id).toBe(recreated[0].id);

  await expect(root.getByText('Save failed')).toHaveCount(0);
});

test('editing a content while its first save is in flight keeps the same row', async ({ page }) => {
  const surface = await openDocumentEnvelopeEditor(page);
  const root = surface.root;

  const envelopeId = surface.envelopeId;

  if (!envelopeId) {
    throw new Error('Expected the document editor surface to have an envelopeId');
  }

  await openContentsTab(surface);

  const { firstContentSetInFlight, requestBodies } = await installContentSetLag(page, 4000);

  await placeContentOnPdf(root, 'Text', { x: 150, y: 150 });

  // Wait until the creating save is actually on the wire, then edit.
  await firstContentSetInFlight;

  await dragContent(root, 60, 40);

  await waitForContentsAutosave(surface);
  await expect.poll(async () => (await getContentRows(envelopeId)).length).toBe(1);

  const [afterRace] = await getContentRows(envelopeId);

  // A further edit must update that same row rather than replacing it.
  await dragContent(root, -30, 20);
  await waitForContentsAutosave(surface);

  const rowsAfterEdit = await getContentRows(envelopeId);

  expect(rowsAfterEdit).toHaveLength(1);
  expect(rowsAfterEdit[0].id).toBe(afterRace.id);

  await expect(root.getByText('Save failed')).toHaveCount(0);

  // The save queued during the race must reference the row the first save
  // created, rather than asking for another one to be created.
  expect(requestBodies).toHaveLength(3);
  expect(requestBodies[1]).toContain(afterRace.id);
});
