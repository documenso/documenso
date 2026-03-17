import { type Page, expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';

import {
  type TEnvelopeEditorSurface,
  addEnvelopeItemPdf,
  clickAddMyselfButton,
  clickEnvelopeEditorStep,
  getEnvelopeEditorSettingsTrigger,
  openDocumentEnvelopeEditor,
  openEmbeddedEnvelopeEditor,
  openTemplateEnvelopeEditor,
  persistEmbeddedEnvelope,
  setRecipientEmail,
  setRecipientName,
} from '../fixtures/envelope-editor';
import { expectToastTextToBeVisible } from '../fixtures/generic';

test.use({
  storageState: {
    cookies: [],
    origins: [],
  },
});

const examplePdfBuffer = fs.readFileSync(path.join(__dirname, '../../../../assets/example.pdf'));

const multiPagePdfBuffer = fs.readFileSync(
  path.join(__dirname, '../../../../assets/field-font-alignment.pdf'),
);

// --- Shared helpers ---

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

const getEditButton = (root: Page, index: number) =>
  root.locator('[data-testid^="envelope-item-edit-button-"]').nth(index);

const getEditDialog = (root: Page) => root.getByRole('dialog');

const getEditDialogTitleInput = (root: Page) =>
  root.locator('[data-testid="envelope-item-edit-title-input"]');

const getEditDialogDropzone = (root: Page) =>
  root.locator('[data-testid="envelope-item-edit-dropzone"]');

const getEditDialogSelectedFile = (root: Page) =>
  root.locator('[data-testid="envelope-item-edit-selected-file"]');

const getEditDialogClearFileButton = (root: Page) =>
  root.locator('[data-testid="envelope-item-edit-clear-file"]');

const getEditDialogUpdateButton = (root: Page) =>
  root.locator('[data-testid="envelope-item-edit-update-button"]');

const assertPdfPageCount = async (root: Page, expectedCount: number) => {
  await expect(root.locator('[data-pdf-content]').first()).toHaveAttribute(
    'data-page-count',
    String(expectedCount),
    { timeout: 15000 },
  );
};

const navigateToFieldsPage = async (surface: TEnvelopeEditorSurface) => {
  // Set up a recipient first so the fields page is functional.
  if (surface.isEmbedded) {
    await setRecipientEmail(surface.root, 0, `test-${nanoid(4)}@example.com`);
    await setRecipientName(surface.root, 0, 'Test User');
  } else {
    await clickAddMyselfButton(surface.root);
  }

  await clickEnvelopeEditorStep(surface.root, 'addFields');

  // Wait for the file selector to be visible on the fields page.
  await expect(getEditButton(surface.root, 0)).toBeAttached({ timeout: 10000 });
};

const openEditDialogOnFieldsPage = async (root: Page, index = 0) => {
  // Hover to reveal the edit button, then click it.
  const editButton = getEditButton(root, index);
  await editButton.click({ force: true });
  await expect(getEditDialog(root)).toBeVisible();
};

// --- Flows ---

const runRenameFlow = async (surface: TEnvelopeEditorSurface) => {
  const externalId = `e2e-edit-rename-${nanoid()}`;

  if (surface.isEmbedded && !surface.envelopeId) {
    await addEnvelopeItemPdf(surface.root, 'rename-test.pdf');
  }

  await updateExternalId(surface, externalId);
  await navigateToFieldsPage(surface);

  // Open edit dialog and change the title.
  await openEditDialogOnFieldsPage(surface.root);

  const titleInput = getEditDialogTitleInput(surface.root);
  await expect(titleInput).toBeVisible();

  await titleInput.clear();
  await titleInput.fill('Renamed Document');

  // Update button should be disabled without a replacement file.
  await expect(getEditDialogUpdateButton(surface.root)).toBeDisabled();

  // A replacement file is required for the Update button to be enabled.
  const dropzone = getEditDialogDropzone(surface.root);
  await expect(dropzone).toBeVisible();

  const fileInput = dropzone.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'example.pdf',
    mimeType: 'application/pdf',
    buffer: examplePdfBuffer,
  });

  await expect(getEditDialogSelectedFile(surface.root)).toBeVisible();

  await getEditDialogUpdateButton(surface.root).click();

  // Dialog should close.
  await expect(getEditDialog(surface.root)).not.toBeVisible({ timeout: 10000 });

  return { externalId };
};

const runReplacePdfFlow = async (surface: TEnvelopeEditorSurface) => {
  const externalId = `e2e-edit-replace-${nanoid()}`;

  if (surface.isEmbedded && !surface.envelopeId) {
    await addEnvelopeItemPdf(surface.root, 'replace-test.pdf');
  }

  await updateExternalId(surface, externalId);
  await navigateToFieldsPage(surface);

  // First, assert the page count is 1 (example.pdf has 1 page).
  await assertPdfPageCount(surface.root, 1);

  // Open edit dialog.
  await openEditDialogOnFieldsPage(surface.root);

  // Select a multi-page PDF via the dropzone.
  const dropzone = getEditDialogDropzone(surface.root);
  await expect(dropzone).toBeVisible();

  const fileInput = dropzone.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'field-font-alignment.pdf',
    mimeType: 'application/pdf',
    buffer: multiPagePdfBuffer,
  });

  // Verify file is shown in the selected file display.
  await expect(getEditDialogSelectedFile(surface.root)).toBeVisible();

  // Click Update.
  await getEditDialogUpdateButton(surface.root).click();

  // Dialog should close.
  await expect(getEditDialog(surface.root)).not.toBeVisible({ timeout: 15000 });

  // After replacement, the page count should be 3 (field-font-alignment.pdf has 3 pages).
  await assertPdfPageCount(surface.root, 3);

  return { externalId };
};

const runClearFileSelectionFlow = async (surface: TEnvelopeEditorSurface) => {
  if (surface.isEmbedded && !surface.envelopeId) {
    await addEnvelopeItemPdf(surface.root, 'clear-file-test.pdf');
  }

  await navigateToFieldsPage(surface);

  // Open edit dialog.
  await openEditDialogOnFieldsPage(surface.root);

  // Select a file.
  const dropzone = getEditDialogDropzone(surface.root);
  await expect(dropzone).toBeVisible();

  const fileInput = dropzone.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'to-be-cleared.pdf',
    mimeType: 'application/pdf',
    buffer: examplePdfBuffer,
  });

  // Verify file appears.
  await expect(getEditDialogSelectedFile(surface.root)).toBeVisible();
  await expect(getEditDialogDropzone(surface.root)).not.toBeVisible();

  // Click X to clear.
  await getEditDialogClearFileButton(surface.root).click();

  // Dropzone should reappear.
  await expect(getEditDialogDropzone(surface.root)).toBeVisible();
  await expect(getEditDialogSelectedFile(surface.root)).not.toBeVisible();
};

// --- DB assertion ---

const assertRenamePersistedInDatabase = async ({
  surface,
  externalId,
}: {
  surface: TEnvelopeEditorSurface;
  externalId: string;
}) => {
  const envelope = await prisma.envelope.findFirstOrThrow({
    where: {
      externalId,
      userId: surface.userId,
      teamId: surface.teamId,
      type: surface.envelopeType,
    },
    include: {
      envelopeItems: {
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  expect(envelope.envelopeItems.length).toBeGreaterThanOrEqual(1);
  expect(envelope.envelopeItems[0].title).toBe('Renamed Document');
};

// --- Tests ---

test.describe('document editor', () => {
  test('should rename an envelope item from the fields page', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const result = await runRenameFlow(surface);

    await assertRenamePersistedInDatabase({ surface, ...result });
  });

  test('should replace a PDF from the fields page', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    await runReplacePdfFlow(surface);
  });

  test('should clear a selected file before submitting', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    await runClearFileSelectionFlow(surface);
  });
});

test.describe('template editor', () => {
  test('should rename an envelope item from the fields page', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const result = await runRenameFlow(surface);

    await assertRenamePersistedInDatabase({ surface, ...result });
  });
});

test.describe('embedded create', () => {
  test('should rename an envelope item from the fields page', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
      tokenNamePrefix: 'e2e-edit-dialog-create',
    });

    const result = await runRenameFlow(surface);

    await clickEnvelopeEditorStep(surface.root, 'upload');
    await persistEmbeddedEnvelope(surface);

    await assertRenamePersistedInDatabase({ surface, ...result });
  });

  test('should replace a PDF from the fields page', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
      tokenNamePrefix: 'e2e-edit-dialog-replace',
    });

    await runReplacePdfFlow(surface);
  });
});

test.describe('embedded edit', () => {
  test('should rename an envelope item from the fields page', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'TEMPLATE',
      mode: 'edit',
      tokenNamePrefix: 'e2e-edit-dialog-edit',
    });

    const result = await runRenameFlow(surface);

    await clickEnvelopeEditorStep(surface.root, 'upload');
    await persistEmbeddedEnvelope(surface);

    await assertRenamePersistedInDatabase({ surface, ...result });
  });
});
