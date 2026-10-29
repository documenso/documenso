import fs from 'node:fs';
import path from 'node:path';
import { EnvelopeContentType, ZEnvelopeContentMetaSchema } from '@documenso/lib/types/envelope-content-meta';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { expect, type Page, test } from '@playwright/test';
import {
  getContentCountForPage,
  placeContentOnPdf,
  selectEditorTab,
  waitForContentsAutosave,
} from '../fixtures/contents';
import {
  clickEnvelopeEditorStep,
  getEnvelopeItemReplaceButtons,
  openDocumentEnvelopeEditor,
  type TEnvelopeEditorSurface,
} from '../fixtures/envelope-editor';

test.use({
  storageState: {
    cookies: [],
    origins: [],
  },
});

const examplePdfBuffer = fs.readFileSync(path.join(__dirname, '../../../../assets/example.pdf'));

const multiPagePdfBuffer = fs.readFileSync(path.join(__dirname, '../../../../assets/field-font-alignment.pdf'));

const replacePdf = async (root: Page, buffer: Buffer, name: string) => {
  const replaceButton = getEnvelopeItemReplaceButtons(root).nth(0);
  await expect(replaceButton).toBeVisible();

  const [fileChooser] = await Promise.all([root.waitForEvent('filechooser'), replaceButton.click()]);

  await fileChooser.setFiles({ name, mimeType: 'application/pdf', buffer });

  await expect(replaceButton).toBeDisabled({ timeout: 15000 });
  await expect(replaceButton).toBeEnabled({ timeout: 15000 });
};

const seedContent = async (envelopeId: string, envelopeItemId: string, page: number) =>
  await prisma.envelopeContent.create({
    data: {
      id: generateDatabaseId('envelope_content'),
      envelopeId,
      envelopeItemId,
      contentMeta: ZEnvelopeContentMetaSchema.parse({
        type: EnvelopeContentType.TEXT,
        page,
        positionX: 10,
        positionY: 10,
        width: 20,
        height: 6,
        text: `Page ${page}`,
      }),
    },
  });

const countContents = async (envelopeId: string) => await prisma.envelopeContent.count({ where: { envelopeId } });

/**
 * Replace the current PDF through the edit dialog opened from the file tabs
 * on the fields step, which is the second place a PDF can be replaced from.
 */
const replacePdfViaFieldsStepDialog = async (root: Page, buffer: Buffer, name: string) => {
  // The pencil only shows on hover, so the click is forced.
  await root.locator('[data-testid^="envelope-item-edit-button-"]').first().click({ force: true });

  const dialog = root.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await root
    .locator('[data-testid="envelope-item-edit-dropzone"] input[type="file"]')
    .setInputFiles({ name, mimeType: 'application/pdf', buffer });

  await expect(root.locator('[data-testid="envelope-item-edit-selected-file"]')).toBeVisible();

  await root.locator('[data-testid="envelope-item-edit-update-button"]').click();

  await expect(dialog).not.toBeVisible({ timeout: 15000 });
};

/**
 * Put a three page PDF on the document, seed a content on pages 1 and 3, and
 * load the editor with both in its local state.
 */
const setUpDocumentWithContentOnPageThree = async (root: Page, envelopeId: string) => {
  await replacePdf(root, multiPagePdfBuffer, 'multi-page.pdf');

  const envelope = await prisma.envelope.findFirstOrThrow({
    where: { id: envelopeId },
    include: { envelopeItems: true },
  });

  const envelopeItemId = envelope.envelopeItems[0].id;

  await seedContent(envelopeId, envelopeItemId, 1);
  await seedContent(envelopeId, envelopeItemId, 3);

  expect(await countContents(envelopeId)).toBe(2);

  // Reload so the editor loads both contents into its local state.
  await root.reload();
  await clickEnvelopeEditorStep(root, 'addFields');
  await selectEditorTab(root, 'Contents');

  await expect.poll(async () => await getContentCountForPage(root, 1)).toBe(1);
};

/**
 * After a replacement that dropped page 3, placing a content must only add
 * that one content: nothing the editor was holding may come back.
 */
const assertNoContentResurrectedAfterPlacing = async (
  root: Page,
  surface: TEnvelopeEditorSurface,
  envelopeId: string,
) => {
  await placeContentOnPdf(root, 'Text', { x: 200, y: 260 });

  await waitForContentsAutosave(surface);

  // The placed content, and nothing else.
  expect(await countContents(envelopeId)).toBe(2);

  const contents = await prisma.envelopeContent.findMany({ where: { envelopeId } });

  expect(contents.every((content) => (content.contentMeta.page ?? 1) === 1)).toBe(true);
};

/**
 * Replacing a PDF deletes the contents which sit on pages the new file does
 * not have. The editor keeps its own copy of the contents, so unless that copy
 * is resynced the next save posts the deleted content back and the server,
 * finding no content with that id, creates it again on a page which no longer
 * exists.
 */
test('does not recreate contents removed by a pdf replacement on the upload step', async ({ page }) => {
  const surface = await openDocumentEnvelopeEditor(page);
  const { root, envelopeId } = surface;

  if (!envelopeId) {
    throw new Error('Expected the document editor surface to have an envelopeId');
  }

  await setUpDocumentWithContentOnPageThree(root, envelopeId);

  // Replace with a single page PDF, dropping the content on page 3.
  await clickEnvelopeEditorStep(root, 'upload');
  await expect(root.getByRole('heading', { name: 'Documents' })).toBeVisible();

  await replacePdf(root, examplePdfBuffer, 'single-page.pdf');

  await expect.poll(async () => await countContents(envelopeId)).toBe(1);

  // Any later save posts every content the editor is holding, so placing one
  // is enough to resurrect a stale content.
  await clickEnvelopeEditorStep(root, 'addFields');
  await selectEditorTab(root, 'Contents');

  await assertNoContentResurrectedAfterPlacing(root, surface, envelopeId);
});

/**
 * The fields step has its own replace entry point (the pencil on each file
 * tab). Unlike the upload step it is reached without a step transition, so
 * the editor's local contents are not flushed or reset around it and must be
 * resynced from the replace response itself.
 */
test('does not recreate contents removed by a pdf replacement from the fields step dialog', async ({ page }) => {
  const surface = await openDocumentEnvelopeEditor(page);
  const { root, envelopeId } = surface;

  if (!envelopeId) {
    throw new Error('Expected the document editor surface to have an envelopeId');
  }

  await setUpDocumentWithContentOnPageThree(root, envelopeId);

  // Replace from the fields step, staying on the contents tab throughout.
  await replacePdfViaFieldsStepDialog(root, examplePdfBuffer, 'single-page.pdf');

  await expect.poll(async () => await countContents(envelopeId)).toBe(1);

  // The page 1 content is still drawn after the local resync.
  await expect.poll(async () => await getContentCountForPage(root, 1)).toBe(1);

  await assertNoContentResurrectedAfterPlacing(root, surface, envelopeId);
});
