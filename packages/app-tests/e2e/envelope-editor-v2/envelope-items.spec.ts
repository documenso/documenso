import { type Page, expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedPendingDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';
import {
  type TEnvelopeEditorSurface,
  clickEnvelopeEditorStep,
  getEnvelopeEditorSettingsTrigger,
  getEnvelopeItemDragHandles,
  getEnvelopeItemDropzoneInput,
  getEnvelopeItemRemoveButtons,
  getEnvelopeItemTitleInputs,
  openDocumentEnvelopeEditor,
  openEmbeddedEnvelopeEditor,
  openTemplateEnvelopeEditor,
  persistEmbeddedEnvelope,
} from '../fixtures/envelope-editor';
import { expectToastTextToBeVisible } from '../fixtures/generic';

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

const openSettingsDialog = async (root: Page) => {
  await getEnvelopeEditorSettingsTrigger(root).click();
  await expect(root.getByRole('heading', { name: 'Document Settings' })).toBeVisible();
};

const updateExternalId = async (surface: TEnvelopeEditorSurface, externalId: string) => {
  await openSettingsDialog(surface.root);
  await surface.root.locator('input[name="externalId"]').fill(externalId);
  await surface.root.getByRole('button', { name: 'Update' }).click();

  if (!surface.isEmbedded) {
    await expectToastTextToBeVisible(surface.root, 'Envelope updated');
  }
};

const navigateToAddFieldsAndBack = async (root: Page) => {
  await clickEnvelopeEditorStep(root, 'addFields');
  await expect(root.getByText('Selected Recipient')).toBeVisible();

  await clickEnvelopeEditorStep(root, 'upload');
  await expect(root.getByRole('heading', { name: 'Recipients' })).toBeVisible();
};

const getEnvelopeItemsFromDatabase = async (
  surface: TEnvelopeEditorSurface,
  externalId: string,
) => {
  const envelope = await prisma.envelope.findFirstOrThrow({
    where: {
      externalId,
      userId: surface.userId,
      teamId: surface.teamId,
      type: surface.envelopeType,
    },
    include: {
      envelopeItems: {
        orderBy: {
          order: 'asc',
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return envelope.envelopeItems;
};

type ItemFlowResult = {
  externalId: string;
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
  surface,
  initialCount,
  filesToUpload,
}: {
  surface: TEnvelopeEditorSurface;
  initialCount: number;
  filesToUpload: TestFilePayload[];
}): Promise<ItemFlowResult> => {
  const { root, isEmbedded } = surface;
  const externalId = `e2e-items-${nanoid()}`;

  await updateExternalId(surface, externalId);

  await expect(root.getByRole('heading', { name: 'Documents' })).toBeVisible();

  await expect(getEnvelopeItemTitleInputs(root)).toHaveCount(initialCount);

  // Upload files.
  await uploadFiles(root, filesToUpload);

  const expectedCountAfterUpload = initialCount + filesToUpload.length;

  await expect(getEnvelopeItemTitleInputs(root)).toHaveCount(expectedCountAfterUpload);

  if (!isEmbedded) {
    await navigateToAddFieldsAndBack(root);

    const itemsAfterUpload = await getEnvelopeItemsFromDatabase(surface, externalId);
    expect(itemsAfterUpload).toHaveLength(expectedCountAfterUpload);
  }

  // Rename items.
  await getEnvelopeItemTitleInputs(root).nth(0).fill('Envelope Item A');
  await getEnvelopeItemTitleInputs(root).nth(1).fill('Envelope Item B');

  await expect(getEnvelopeItemTitleInputs(root).nth(0)).toHaveValue('Envelope Item A');
  await expect(getEnvelopeItemTitleInputs(root).nth(1)).toHaveValue('Envelope Item B');

  if (!isEmbedded) {
    await navigateToAddFieldsAndBack(root);

    const itemsAfterRename = await getEnvelopeItemsFromDatabase(surface, externalId);
    expect(itemsAfterRename[0].title).toBe('Envelope Item A');
    expect(itemsAfterRename[1].title).toBe('Envelope Item B');
  }

  // Reorder items.
  await dragEnvelopeItemByHandle({
    root,
    sourceIndex: 0,
    targetIndex: 1,
  });

  await expect
    .poll(async () => await getCurrentTitles(root))
    .toEqual(['Envelope Item B', 'Envelope Item A']);

  if (!isEmbedded) {
    await navigateToAddFieldsAndBack(root);

    const itemsAfterReorder = await getEnvelopeItemsFromDatabase(surface, externalId);
    expect(itemsAfterReorder[0].title).toBe('Envelope Item B');
    expect(itemsAfterReorder[1].title).toBe('Envelope Item A');
  }

  // Remove first item.
  await getEnvelopeItemRemoveButtons(root).first().click();

  if (!isEmbedded) {
    await root.getByRole('button', { name: 'Delete' }).click();
  }

  await expect(getEnvelopeItemTitleInputs(root)).toHaveCount(expectedCountAfterUpload - 1);

  if (!isEmbedded) {
    await navigateToAddFieldsAndBack(root);

    const itemsAfterRemove = await getEnvelopeItemsFromDatabase(surface, externalId);
    expect(itemsAfterRemove).toHaveLength(expectedCountAfterUpload - 1);
  }

  return {
    externalId,
  };
};

test.describe('document editor', () => {
  test('add, remove, reorder and retitle items', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);

    const result = await runEnvelopeItemCrudFlow({
      surface,
      initialCount: 1,
      filesToUpload: [createPdfPayload('document-item-added.pdf')],
    });

    const items = await getEnvelopeItemsFromDatabase(surface, result.externalId);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Envelope Item A');
    expect(items[0].order).toBe(2); // Expect order 2 because deleting items does not drop the order of sequential items.
  });
});

test.describe('template editor', () => {
  test('add, remove, reorder and retitle items', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);

    const result = await runEnvelopeItemCrudFlow({
      surface,
      initialCount: 1,
      filesToUpload: [createPdfPayload('template-item-added.pdf')],
    });

    const items = await getEnvelopeItemsFromDatabase(surface, result.externalId);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Envelope Item A');
    expect(items[0].order).toBe(2); // Expect order 2 because deleting items does not drop the order of sequential items.
  });
});

test.describe('embedded create', () => {
  test('add, remove, reorder and retitle items', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
      tokenNamePrefix: 'e2e-embed-items',
    });

    const result = await runEnvelopeItemCrudFlow({
      surface,
      initialCount: 0,
      filesToUpload: [
        createPdfPayload('embedded-document-item-a.pdf'),
        createPdfPayload('embedded-document-item-b.pdf'),
      ],
    });

    await persistEmbeddedEnvelope(surface);

    const items = await getEnvelopeItemsFromDatabase(surface, result.externalId);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Envelope Item A');
    expect(items[0].order).toBe(1); // Expect order 1 because this is a one shot create via embedding. There are no incremental updates.
  });
});

test.describe('embedded edit', () => {
  test('add, remove, reorder and retitle items', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'TEMPLATE',
      mode: 'edit',
      tokenNamePrefix: 'e2e-embed-items',
    });

    const result = await runEnvelopeItemCrudFlow({
      surface,
      initialCount: 1,
      filesToUpload: [createPdfPayload('embedded-template-item-updated.pdf')],
    });

    await persistEmbeddedEnvelope(surface);

    const items = await getEnvelopeItemsFromDatabase(surface, result.externalId);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Envelope Item A');
    expect(items[0].order).toBe(2); // Expect order 2 because deleting items does not drop the order of sequential items.
  });
});

test.describe('pending envelope title editing', () => {
  test('edit envelope and item titles on a pending envelope', async ({ page }) => {
    const recipientEmail = `recipient-${nanoid()}@test.documenso.com`;
    const { user, team } = await seedUser();
    const pendingDocument = await seedPendingDocument(user, team.id, [recipientEmail], {
      internalVersion: 2,
    });

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents/${pendingDocument.id}/edit`,
    });

    // Verify the envelope editor loaded with the upload step visible.
    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

    // Edit the envelope title in the header.
    const envelopeTitleInput = page.locator('[data-testid="envelope-title-input"]');
    await expect(envelopeTitleInput).toBeEnabled();
    await envelopeTitleInput.fill('Updated Pending Title');

    // Edit the envelope item title.
    const itemTitleInput = getEnvelopeItemTitleInputs(page).first();
    await expect(itemTitleInput).toBeEnabled();
    await itemTitleInput.fill('Updated Item Title');

    // Wait for debounced auto-save to persist by navigating away and back.
    await clickEnvelopeEditorStep(page, 'addFields');
    await expect(page.getByText('Selected Recipient')).toBeVisible();
    await clickEnvelopeEditorStep(page, 'upload');
    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

    // Verify the titles persisted in the database.
    const updatedEnvelope = await prisma.envelope.findFirstOrThrow({
      where: { id: pendingDocument.id },
      include: {
        envelopeItems: true,
        auditLogs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    expect(updatedEnvelope.title).toBe('Updated Pending Title');
    expect(updatedEnvelope.envelopeItems[0].title).toBe('Updated Item Title');

    // Verify audit logs were created for both title changes.
    const titleAuditLog = updatedEnvelope.auditLogs.find(
      (log) => log.type === 'DOCUMENT_TITLE_UPDATED',
    );
    expect(titleAuditLog).toBeDefined();

    const itemAuditLog = updatedEnvelope.auditLogs.find(
      (log) => log.type === 'ENVELOPE_ITEM_UPDATED',
    );
    expect(itemAuditLog).toBeDefined();

    // Verify the upload dropzone is still disabled for pending envelopes.
    const dropzoneMessage = page.getByText('Cannot upload items after the document has been sent');
    await expect(dropzoneMessage).toBeVisible();

    // Drag handles are still rendered but dragging is disabled via isDragDisabled
    // when canItemsBeModified is false. Verify at least that the handle is present
    // but we cannot programmatically assert isDragDisabled from the DOM.
    await expect(getEnvelopeItemDragHandles(page)).toHaveCount(1);
  });
});
