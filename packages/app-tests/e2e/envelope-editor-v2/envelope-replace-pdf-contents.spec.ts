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
        rotation: 0,
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
 * Replacing a PDF deletes the contents which sit on pages the new file does
 * not have. The editor keeps its own copy of the contents, so unless that copy
 * is resynced the next save posts the deleted content back and the server,
 * finding no content with that id, creates it again on a page which no longer
 * exists.
 */
test('does not recreate contents removed by a pdf replacement', async ({ page }) => {
  const surface = await openDocumentEnvelopeEditor(page);
  const { root, envelopeId } = surface;

  // A three page PDF so a content can live on a page the replacement drops.
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

  // Replace with a single page PDF, dropping the content on page 3.
  await clickEnvelopeEditorStep(root, 'upload');
  await expect(root.getByRole('heading', { name: 'Documents' })).toBeVisible();

  await replacePdf(root, examplePdfBuffer, 'single-page.pdf');

  await expect.poll(async () => await countContents(envelopeId)).toBe(1);

  // Any later save posts every content the editor is holding, so placing one
  // is enough to resurrect a stale content.
  await clickEnvelopeEditorStep(root, 'addFields');
  await selectEditorTab(root, 'Contents');

  await placeContentOnPdf(root, 'Text', { x: 200, y: 260 });

  await waitForContentsAutosave(surface);

  // The placed content, and nothing else.
  expect(await countContents(envelopeId)).toBe(2);

  const pages = await prisma.envelopeContent.findMany({ where: { envelopeId } });

  expect(pages.every((content) => (content.contentMeta.page ?? 1) === 1)).toBe(true);
});
