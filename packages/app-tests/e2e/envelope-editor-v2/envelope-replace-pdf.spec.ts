import { type Page, expect, test } from '@playwright/test';
import { FieldType } from '@prisma/client';
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
  getEnvelopeItemDropzoneInput,
  getEnvelopeItemReplaceButtons,
  openDocumentEnvelopeEditor,
  openEmbeddedEnvelopeEditor,
  openTemplateEnvelopeEditor,
  persistEmbeddedEnvelope,
  setRecipientEmail,
  setRecipientName,
} from '../fixtures/envelope-editor';
import { expectToastTextToBeVisible } from '../fixtures/generic';
import { getKonvaElementCountForPage } from '../fixtures/konva';

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

const multiPagePdfBuffer = fs.readFileSync(
  path.join(__dirname, '../../../../assets/field-font-alignment.pdf'),
);

const createPdfPayload = (name: string, buffer: Buffer = examplePdfBuffer): TestFilePayload => ({
  name,
  mimeType: 'application/pdf',
  buffer,
});

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

const replaceEnvelopeItemPdf = async (
  root: Page,
  index: number,
  file: TestFilePayload,
  options?: { isEmbedded?: boolean },
) => {
  const replaceButton = getEnvelopeItemReplaceButtons(root).nth(index);
  await expect(replaceButton).toBeVisible();

  // Listen for the file chooser event before clicking so the native dialog
  // is intercepted and never actually shown to the user.
  const [fileChooser] = await Promise.all([
    root.waitForEvent('filechooser'),
    replaceButton.click(),
  ]);

  await fileChooser.setFiles(file);

  // The button stays in the DOM but becomes disabled while the replace
  // mutation is in flight, then re-enables once the mutation completes.
  // Wait for both transitions to guarantee the replace has fully finished.
  //
  // For embedded surfaces the replacement is purely local state with no
  // network round-trip, so it can complete before Playwright observes the
  // disabled state. Skip the disabled assertion for embedded surfaces.
  if (!options?.isEmbedded) {
    await expect(replaceButton).toBeDisabled({ timeout: 15000 });
  }

  await expect(replaceButton).toBeEnabled({ timeout: 15000 });
};

const assertPdfPageCount = async (root: Page, expectedCount: number) => {
  await expect(root.locator('[data-pdf-content]').first()).toHaveAttribute(
    'data-page-count',
    String(expectedCount),
    { timeout: 15000 },
  );
};

const placeFieldOnPdf = async (
  root: Page,
  fieldName: 'Signature' | 'Text',
  position: { x: number; y: number },
) => {
  await root.getByRole('button', { name: fieldName, exact: true }).click();

  const canvas = root.locator('.konva-container canvas').first();
  await expect(canvas).toBeVisible();
  await canvas.click({ position });
};

const scrollToPage = async (root: Page, pageNumber: number) => {
  const pageImage = root.locator(`img[data-page-number="${pageNumber}"]`);
  await pageImage.scrollIntoViewIfNeeded();
  await expect(pageImage).toBeVisible({ timeout: 10000 });
  // Wait for the Konva stage to initialize after virtualized rendering.
  await root.waitForTimeout(1000);
};

const placeFieldOnPage = async (
  root: Page,
  pageNumber: number,
  fieldName: 'Signature' | 'Text',
  position: { x: number; y: number },
) => {
  await root.getByRole('button', { name: fieldName, exact: true }).click();

  if (pageNumber > 1) {
    await scrollToPage(root, pageNumber);
  }

  // Find the canvas corresponding to this page number via Konva stages.
  // Since the virtualized list may have multiple canvases, we target the one
  // that belongs to the correct page by using the evaluate approach.
  const canvas = root.locator('.konva-container canvas');

  if (pageNumber === 1) {
    await expect(canvas.first()).toBeVisible();
    await canvas.first().click({ position });
  } else {
    // For multi-page, find the canvas at the page position.
    // The canvases are rendered in page order within the viewport.
    // After scrolling to page N, it should be visible. We use nth based on
    // the page index among currently rendered canvases.
    // A more reliable approach: click on the page's img and offset into canvas.
    const pageImg = root.locator(`img[data-page-number="${pageNumber}"]`);
    const pageBox = await pageImg.boundingBox();

    if (!pageBox) {
      throw new Error(`Could not find bounding box for page ${pageNumber}`);
    }

    // Click at the desired position relative to the page image.
    // The Konva canvas overlays the image, so clicking at the same coordinates works.
    await root.mouse.click(pageBox.x + position.x, pageBox.y + position.y);
  }
};

// --- Test 1: Basic replace flow ---

type BasicReplaceFlowResult = {
  externalId: string;
  originalDocumentDataId: string | null;
};

const runBasicReplaceFlow = async (
  surface: TEnvelopeEditorSurface,
): Promise<BasicReplaceFlowResult> => {
  const { root, isEmbedded } = surface;
  const externalId = `e2e-replace-${nanoid()}`;

  // For embedded create, upload a PDF first.
  if (isEmbedded && !surface.envelopeId) {
    await addEnvelopeItemPdf(root, 'replace-test-original.pdf');
  }

  await updateExternalId(surface, externalId);

  // Record the original documentDataId so we can assert it changed after replace.
  // For embedded flows the externalId only lives in client state until persist,
  // so query by envelope ID when available, and skip entirely for embedded create.
  let originalDocumentDataId: string | null = null;

  if (!isEmbedded) {
    const envelope = await prisma.envelope.findFirstOrThrow({
      where: {
        externalId,
        userId: surface.userId,
        teamId: surface.teamId,
        type: surface.envelopeType,
      },
      include: {
        envelopeItems: { orderBy: { order: 'asc' } },
      },
    });

    originalDocumentDataId = envelope.envelopeItems[0].documentDataId;
  } else if (surface.envelopeId) {
    const envelope = await prisma.envelope.findFirstOrThrow({
      where: {
        id: surface.envelopeId,
      },
      include: {
        envelopeItems: { orderBy: { order: 'asc' } },
      },
    });

    originalDocumentDataId = envelope.envelopeItems[0].documentDataId;
  }

  // Navigate to addFields step to verify initial page count.
  await clickEnvelopeEditorStep(root, 'addFields');
  await root.locator('[data-pdf-content]').first().waitFor({ state: 'visible', timeout: 15000 });
  await assertPdfPageCount(root, 1);

  // Navigate back to upload step.
  await clickEnvelopeEditorStep(root, 'upload');
  await expect(root.getByRole('heading', { name: 'Documents' })).toBeVisible();

  // Replace the PDF.
  await replaceEnvelopeItemPdf(root, 0, createPdfPayload('replace-test-new.pdf'), { isEmbedded });

  // Navigate to addFields step to verify the PDF loaded correctly.
  await clickEnvelopeEditorStep(root, 'addFields');
  await root.locator('[data-pdf-content]').first().waitFor({ state: 'visible', timeout: 15000 });
  await assertPdfPageCount(root, 1);

  // Navigate back to upload step.
  await clickEnvelopeEditorStep(root, 'upload');
  await expect(root.getByRole('heading', { name: 'Documents' })).toBeVisible();

  return { externalId, originalDocumentDataId };
};

const assertBasicReplaceInDatabase = async ({
  surface,
  externalId,
  originalDocumentDataId,
}: {
  surface: TEnvelopeEditorSurface;
  externalId: string;
  originalDocumentDataId: string | null;
}) => {
  const envelope = await prisma.envelope.findFirstOrThrow({
    where: {
      externalId,
      userId: surface.userId,
      teamId: surface.teamId,
      type: surface.envelopeType,
    },
    include: {
      envelopeItems: { orderBy: { order: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  expect(envelope.envelopeItems).toHaveLength(1);

  const item = envelope.envelopeItems[0];

  // The documentDataId should have changed after replace.
  if (originalDocumentDataId) {
    expect(item.documentDataId).not.toBe(originalDocumentDataId);
  }

  // Verify documentDataId is a valid non-empty string.
  expect(item.documentDataId).toBeTruthy();
  expect(typeof item.documentDataId).toBe('string');

  // Title and order should be unchanged.
  expect(item.order).toBeGreaterThanOrEqual(1);
};

// --- Test 2: Field cleanup replace flow ---

const TEST_FIELD_VALUES = {
  embeddedRecipient: {
    email: 'embedded-replace-recipient@documenso.com',
    name: 'Embedded Replace Recipient',
  },
};

type FieldCleanupFlowResult = {
  externalId: string;
  recipientEmail: string;
};

const setupRecipient = async (surface: TEnvelopeEditorSurface): Promise<string> => {
  if (surface.isEmbedded) {
    await setRecipientEmail(surface.root, 0, TEST_FIELD_VALUES.embeddedRecipient.email);
    await setRecipientName(surface.root, 0, TEST_FIELD_VALUES.embeddedRecipient.name);
    return TEST_FIELD_VALUES.embeddedRecipient.email;
  }

  await clickAddMyselfButton(surface.root);
  return surface.userEmail;
};

const uploadMultiPagePdf = async (root: Page) => {
  await getEnvelopeItemDropzoneInput(root).setInputFiles({
    name: 'multi-page.pdf',
    mimeType: 'application/pdf',
    buffer: multiPagePdfBuffer,
  });
};

const runFieldCleanupReplaceFlow = async (
  surface: TEnvelopeEditorSurface,
): Promise<FieldCleanupFlowResult> => {
  const { root, isEmbedded } = surface;
  const externalId = `e2e-replace-fields-${nanoid()}`;

  // Step 1: Get a 3-page PDF loaded.
  if (isEmbedded && !surface.envelopeId) {
    // Embedded create: upload the multi-page PDF directly.
    await uploadMultiPagePdf(root);
  } else {
    // All other surfaces: replace the existing 1-page PDF with the 3-page one.
    await replaceEnvelopeItemPdf(root, 0, createPdfPayload('multi-page.pdf', multiPagePdfBuffer), {
      isEmbedded,
    });
  }

  await updateExternalId(surface, externalId);

  // Step 2: Add a recipient.
  const recipientEmail = await setupRecipient(surface);

  // Step 3: Navigate to addFields step and verify 3-page PDF is loaded.
  await clickEnvelopeEditorStep(root, 'addFields');
  await root.locator('[data-pdf-content]').first().waitFor({ state: 'visible', timeout: 15000 });
  await assertPdfPageCount(root, 3);

  // Step 4: Place a Signature field on page 1.
  await placeFieldOnPdf(root, 'Signature', { x: 120, y: 140 });
  let fieldCountPage1 = await getKonvaElementCountForPage(root, 1, '.field-group');
  expect(fieldCountPage1).toBe(1);

  // Step 5: Scroll to page 2 and place a Text field.
  await placeFieldOnPage(root, 2, 'Text', { x: 120, y: 140 });
  const fieldCountPage2 = await getKonvaElementCountForPage(root, 2, '.field-group');
  expect(fieldCountPage2).toBe(1);

  // Verify file selector shows "2 Fields".
  await expect(root.getByText('2 Fields')).toBeVisible();

  // Step 6: Navigate back to upload step.
  await clickEnvelopeEditorStep(root, 'upload');
  await expect(root.getByRole('heading', { name: 'Documents' })).toBeVisible();

  // Step 7: Replace with 1-page PDF.
  await replaceEnvelopeItemPdf(root, 0, createPdfPayload('single-page.pdf'), { isEmbedded });

  // Step 8: Navigate to addFields step to verify.
  await clickEnvelopeEditorStep(root, 'addFields');
  await root.locator('[data-pdf-content]').first().waitFor({ state: 'visible', timeout: 15000 });

  // PDF should now be 1 page.
  await assertPdfPageCount(root, 1);

  // Page 1 field should survive.
  fieldCountPage1 = await getKonvaElementCountForPage(root, 1, '.field-group');
  expect(fieldCountPage1).toBe(1);

  // File selector should show "1 Field".
  await expect(root.getByText('1 Field')).toBeVisible();

  return { externalId, recipientEmail };
};

const assertFieldCleanupInDatabase = async ({
  surface,
  externalId,
  recipientEmail,
}: {
  surface: TEnvelopeEditorSurface;
  externalId: string;
  recipientEmail: string;
}) => {
  const envelope = await prisma.envelope.findFirstOrThrow({
    where: {
      externalId,
      userId: surface.userId,
      teamId: surface.teamId,
      type: surface.envelopeType,
    },
    include: {
      fields: true,
      recipients: true,
      envelopeItems: { orderBy: { order: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const recipient = envelope.recipients.find((r) => r.email === recipientEmail);
  expect(recipient).toBeDefined();

  // Only the page-1 field should remain.
  expect(envelope.fields).toHaveLength(1);
  expect(envelope.fields[0].page).toBe(1);
  expect(envelope.fields[0].type).toBe(FieldType.SIGNATURE);
  expect(envelope.fields[0].recipientId).toBe(recipient?.id);

  // The envelope item should have a 1-page PDF (documentDataId should exist).
  expect(envelope.envelopeItems).toHaveLength(1);
  expect(envelope.envelopeItems[0].documentDataId).toBeTruthy();
};

// --- Test describe blocks ---

test.describe('document editor', () => {
  test('replace PDF on an envelope item', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const result = await runBasicReplaceFlow(surface);

    await assertBasicReplaceInDatabase({
      surface,
      ...result,
    });
  });

  test('replace PDF deletes fields on out-of-bounds pages', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const result = await runFieldCleanupReplaceFlow(surface);

    await assertFieldCleanupInDatabase({
      surface,
      ...result,
    });
  });
});

test.describe('template editor', () => {
  test('replace PDF on an envelope item', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const result = await runBasicReplaceFlow(surface);

    await assertBasicReplaceInDatabase({
      surface,
      ...result,
    });
  });

  test('replace PDF deletes fields on out-of-bounds pages', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const result = await runFieldCleanupReplaceFlow(surface);

    await assertFieldCleanupInDatabase({
      surface,
      ...result,
    });
  });
});

test.describe('embedded create', () => {
  test('replace PDF on an envelope item', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
      tokenNamePrefix: 'e2e-embed-replace',
    });

    const result = await runBasicReplaceFlow(surface);

    await persistEmbeddedEnvelope(surface);

    await assertBasicReplaceInDatabase({
      surface,
      ...result,
    });
  });

  test('replace PDF deletes fields on out-of-bounds pages', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
      tokenNamePrefix: 'e2e-embed-replace-fields',
    });

    const result = await runFieldCleanupReplaceFlow(surface);

    await persistEmbeddedEnvelope(surface);

    await assertFieldCleanupInDatabase({
      surface,
      ...result,
    });
  });
});

test.describe('embedded edit', () => {
  test('replace PDF on an envelope item', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'TEMPLATE',
      mode: 'edit',
      tokenNamePrefix: 'e2e-embed-replace',
    });

    const result = await runBasicReplaceFlow(surface);

    await persistEmbeddedEnvelope(surface);

    await assertBasicReplaceInDatabase({
      surface,
      ...result,
    });
  });

  test('replace PDF deletes fields on out-of-bounds pages', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'TEMPLATE',
      mode: 'edit',
      tokenNamePrefix: 'e2e-embed-replace-fields',
    });

    const result = await runFieldCleanupReplaceFlow(surface);

    await persistEmbeddedEnvelope(surface);

    await assertFieldCleanupInDatabase({
      surface,
      ...result,
    });
  });
});
