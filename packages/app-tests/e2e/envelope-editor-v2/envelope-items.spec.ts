import { type Page, expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import {
  type TEnvelopeEditorSurface,
  getEnvelopeItemDragHandles,
  getEnvelopeItemDropzoneInput,
  getEnvelopeItemRemoveButtons,
  getEnvelopeItemTitleInputs,
  openDocumentEnvelopeEditor,
  openEmbeddedEnvelopeEditor,
  openTemplateEnvelopeEditor,
} from '../fixtures/envelope-editor';

test.use({
  storageState: {
    cookies: [],
    origins: [],
  },
});

type TestFilePayload = {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

const examplePdfBuffer = fs.readFileSync(path.join(__dirname, '../../../../assets/example.pdf'));

const createPdfPayload = (name: string): TestFilePayload => ({
  name,
  mimeType: 'application/pdf',
  buffer: examplePdfBuffer,
});

const getCurrentTitles = async (root: Page) => {
  const titleInputs = getEnvelopeItemTitleInputs(root);
  const count = await titleInputs.count();

  return await Promise.all(
    Array.from({ length: count }, async (_, index) => await titleInputs.nth(index).inputValue()),
  );
};

const uploadFiles = async (root: Page, files: TestFilePayload[]) => {
  const input = getEnvelopeItemDropzoneInput(root);

  await input.setInputFiles(files);
};

const dragEnvelopeItemByHandle = async ({
  root,
  sourceIndex,
  targetIndex,
}: {
  root: Page;
  sourceIndex: number;
  targetIndex: number;
}) => {
  const sourceHandle = getEnvelopeItemDragHandles(root).nth(sourceIndex);
  const targetHandle = getEnvelopeItemDragHandles(root).nth(targetIndex);

  await expect(sourceHandle).toBeVisible();
  await expect(targetHandle).toBeVisible();

  const sourceBox = await sourceHandle.boundingBox();
  const targetBox = await targetHandle.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error('Could not resolve drag handle bounding boxes');
  }

  const sourceX = sourceBox.x + sourceBox.width / 2;
  const sourceY = sourceBox.y + sourceBox.height / 2;
  const targetX = targetBox.x + targetBox.width / 2;
  const targetY = targetBox.y + targetBox.height / 2;

  await root.mouse.move(sourceX, sourceY);
  await root.mouse.down();
  await root.mouse.move(targetX, targetY, { steps: 20 });
  await root.mouse.up();
};

const runEnvelopeItemCrudFlow = async ({
  root,
  isEmbedded,
  initialCount,
  filesToUpload,
}: TEnvelopeEditorSurface & {
  initialCount: number;
  filesToUpload: TestFilePayload[];
}) => {
  await expect(root.getByRole('heading', { name: 'Documents' })).toBeVisible();

  await expect(getEnvelopeItemTitleInputs(root)).toHaveCount(initialCount);

  await uploadFiles(root, filesToUpload);

  const expectedCountAfterUpload = initialCount + filesToUpload.length;

  await expect(getEnvelopeItemTitleInputs(root)).toHaveCount(expectedCountAfterUpload);

  await getEnvelopeItemTitleInputs(root).nth(0).fill('Envelope Item A');
  await getEnvelopeItemTitleInputs(root).nth(1).fill('Envelope Item B');

  await expect(getEnvelopeItemTitleInputs(root).nth(0)).toHaveValue('Envelope Item A');
  await expect(getEnvelopeItemTitleInputs(root).nth(1)).toHaveValue('Envelope Item B');

  await dragEnvelopeItemByHandle({
    root,
    sourceIndex: 0,
    targetIndex: 1,
  });

  await expect
    .poll(async () => await getCurrentTitles(root))
    .toEqual(['Envelope Item B', 'Envelope Item A']);

  await getEnvelopeItemRemoveButtons(root).first().click();

  if (!isEmbedded) {
    await root.getByRole('button', { name: 'Delete' }).click();
  }

  await expect(getEnvelopeItemTitleInputs(root)).toHaveCount(expectedCountAfterUpload - 1);
};

test.describe('Envelope Editor V2 - Envelope item CRUD', () => {
  test('documents/<id>: add, remove, reorder and retitle items', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);

    await runEnvelopeItemCrudFlow({
      ...surface,
      initialCount: 1,
      filesToUpload: [createPdfPayload('document-item-added.pdf')],
    });
  });

  test('templates/<id>: add, remove, reorder and retitle items', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);

    await runEnvelopeItemCrudFlow({
      ...surface,
      initialCount: 1,
      filesToUpload: [createPdfPayload('template-item-added.pdf')],
    });
  });

  test('/embed/v2/authoring/envelope/create DOCUMENT: add, remove, reorder and retitle items', async ({
    page,
  }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
    });

    await runEnvelopeItemCrudFlow({
      ...surface,
      initialCount: 0,
      filesToUpload: [
        createPdfPayload('embedded-document-item-a.pdf'),
        createPdfPayload('embedded-document-item-b.pdf'),
      ],
    });
  });

  test('/embed/v2/authoring/envelope/edit/<id> TEMPLATE: add, remove, reorder and retitle items', async ({
    page,
  }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'TEMPLATE',
      mode: 'edit',
      tokenNamePrefix: 'e2e-embed-items',
    });

    await runEnvelopeItemCrudFlow({
      ...surface,
      initialCount: 1,
      filesToUpload: [createPdfPayload('embedded-template-item-updated.pdf')],
    });
  });
});
