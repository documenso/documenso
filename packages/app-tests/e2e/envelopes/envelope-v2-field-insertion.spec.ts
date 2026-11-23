import { DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import { prisma } from '@documenso/prisma';
import { expect, test } from '@playwright/test';
import { DocumentStatus, FieldType } from '@prisma/client';
import { DateTime } from 'luxon';

import { apiSeedPendingDocument } from '../fixtures/api-seeds';
import { getCanvasBox, getPageCanvas } from '../fixtures/contents';
import { getKonvaFieldTextForPage } from '../fixtures/konva';

const PDF_PAGE_SELECTOR = 'img[data-page-number]';

test.describe('V2 envelope field insertion during signing', () => {
  test('date fields are auto-inserted when completing a V2 envelope', async ({ page, request }) => {
    const now = DateTime.now().setZone(DEFAULT_DOCUMENT_TIME_ZONE);

    const { envelope, distributeResult } = await apiSeedPendingDocument(request, {
      recipients: [{ email: 'signer-date@test.documenso.com', name: 'Date Signer' }],
      fieldsPerRecipient: [
        [
          { type: FieldType.DATE, page: 1, positionX: 5, positionY: 5, width: 5, height: 5 },
          { type: FieldType.SIGNATURE, page: 1, positionX: 5, positionY: 15, width: 5, height: 5 },
        ],
      ],
    });

    const { token } = distributeResult.recipients[0];

    await page.goto(`/sign/${token}`);

    // wait for PDF to be visible
    await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

    // Wait for the Konva canvas to be ready.
    const canvas = page.locator('.konva-container canvas').first();
    await expect(canvas).toBeVisible({ timeout: 30_000 });

    // DATE is auto-filled, but SIGNATURE still needs manual interaction.
    await expect(page.getByText('1 Field Remaining').first()).toBeVisible();

    // Set up a signature via the sidebar form.
    await page.getByTestId('signature-pad-dialog-button').click();
    await page.getByRole('tab', { name: 'Type' }).click();
    await page.getByTestId('signature-pad-type-input').fill('Signature');
    await page.getByRole('button', { name: 'Next' }).click();

    // Click the signature field on the canvas.
    const canvasBox = await canvas.boundingBox();

    if (!canvasBox) {
      throw new Error('Canvas bounding box not found');
    }

    const sigField = envelope.fields.find((f) => f.type === FieldType.SIGNATURE);

    if (!sigField) {
      throw new Error('Signature field not found');
    }

    const x =
      (Number(sigField.positionX) / 100) * canvasBox.width + ((Number(sigField.width) / 100) * canvasBox.width) / 2;
    const y =
      (Number(sigField.positionY) / 100) * canvasBox.height + ((Number(sigField.height) / 100) * canvasBox.height) / 2;

    await canvas.click({ position: { x, y } });

    await expect(page.getByText('0 Fields Remaining').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Complete' }).click();
    await expect(page.getByRole('heading', { name: 'Are you sure?' })).toBeVisible();
    await page.getByRole('button', { name: 'Sign' }).click();

    await page.waitForURL(`/sign/${token}/complete`);
    await expect(page.getByText('Document Signed')).toBeVisible();

    // Verify the date field was inserted in the database with the correct format.
    const dateField = await prisma.field.findFirstOrThrow({
      where: {
        envelopeId: envelope.id,
        type: FieldType.DATE,
      },
    });

    expect(dateField.inserted).toBe(true);
    expect(dateField.customText).toBeTruthy();

    // Verify the inserted date is close to now (within 2 minutes).
    const insertedDate = DateTime.fromFormat(dateField.customText, DEFAULT_DOCUMENT_DATE_FORMAT, {
      zone: DEFAULT_DOCUMENT_TIME_ZONE,
    });

    expect(insertedDate.isValid).toBe(true);
    expect(Math.abs(insertedDate.diff(now, 'minutes').minutes)).toBeLessThanOrEqual(2);

    // Verify the document reached COMPLETED status.
    await expect(async () => {
      const dbEnvelope = await prisma.envelope.findUniqueOrThrow({
        where: { id: envelope.id },
      });

      expect(dbEnvelope.status).toBe(DocumentStatus.COMPLETED);
    }).toPass();
  });

  test('date and email fields are inserted when completing a V2 envelope with multiple field types', async ({
    page,
    request,
  }) => {
    const now = DateTime.now().setZone(DEFAULT_DOCUMENT_TIME_ZONE);

    const recipientEmail = 'signer-multi@test.documenso.com';

    const { envelope, distributeResult } = await apiSeedPendingDocument(request, {
      recipients: [{ email: recipientEmail, name: 'Multi Signer' }],
      fieldsPerRecipient: [
        [
          { type: FieldType.DATE, page: 1, positionX: 5, positionY: 5, width: 5, height: 5 },
          { type: FieldType.EMAIL, page: 1, positionX: 5, positionY: 10, width: 5, height: 5 },
          { type: FieldType.NAME, page: 1, positionX: 5, positionY: 15, width: 5, height: 5 },
          {
            type: FieldType.SIGNATURE,
            page: 1,
            positionX: 5,
            positionY: 20,
            width: 5,
            height: 5,
          },
        ],
      ],
    });

    const { token } = distributeResult.recipients[0];

    // Resolve the fields from the envelope for position calculations.
    const fields = envelope.fields;

    await page.goto(`/sign/${token}`);

    // wait for PDF to be visible
    await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

    // Wait for the Konva canvas to be ready.
    const canvas = page.locator('.konva-container canvas').first();
    await expect(canvas).toBeVisible({ timeout: 30_000 });

    // DATE and EMAIL fields are auto-filled, so only NAME and SIGNATURE remain.
    await expect(page.getByText('2 Fields Remaining').first()).toBeVisible();

    // Set up a signature via the sidebar form.
    await page.getByTestId('signature-pad-dialog-button').click();
    await page.getByRole('tab', { name: 'Type' }).click();
    await page.getByTestId('signature-pad-type-input').fill('Signature');
    await page.getByRole('button', { name: 'Next' }).click();

    // Click each non-date field on the Konva canvas to insert it.
    // Fields are seeded with positions as percentages of the page.
    // We need to convert these percentages to pixel positions on the canvas.
    const canvasBox = await canvas.boundingBox();

    if (!canvasBox) {
      throw new Error('Canvas bounding box not found');
    }

    // Only NAME and SIGNATURE fields need manual interaction (DATE and EMAIL are auto-filled).
    const manualFields = fields.filter((f) => f.type !== FieldType.DATE && f.type !== FieldType.EMAIL);

    for (const field of manualFields) {
      const x = (Number(field.positionX) / 100) * canvasBox.width + ((Number(field.width) / 100) * canvasBox.width) / 2;
      const y =
        (Number(field.positionY) / 100) * canvasBox.height + ((Number(field.height) / 100) * canvasBox.height) / 2;

      await canvas.click({ position: { x, y } });

      if (field.type === FieldType.NAME) {
        const nameDialog = page.getByRole('dialog');
        const isDialogVisible = await nameDialog.isVisible().catch(() => false);

        if (isDialogVisible) {
          const nameInput = nameDialog.locator('input[type="text"], input[name="name"]').first();
          const isInputVisible = await nameInput.isVisible().catch(() => false);

          if (isInputVisible) {
            await nameInput.fill('Test Signer');
          }

          const saveButton = nameDialog.getByRole('button', { name: 'Save' });
          const isButtonVisible = await saveButton.isVisible().catch(() => false);

          if (isButtonVisible) {
            await saveButton.click();
          }
        }
      }

      // Small delay to allow the field signing to complete.
      await page.waitForTimeout(500);
    }

    // All fields should now be complete.
    await expect(page.getByText('0 Fields Remaining').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Complete' }).click();
    await expect(page.getByRole('heading', { name: 'Are you sure?' })).toBeVisible();
    await page.getByRole('button', { name: 'Sign' }).click();

    await page.waitForURL(`/sign/${token}/complete`);
    await expect(page.getByText('Document Signed')).toBeVisible();

    // Verify the date field was auto-inserted with the correct format.
    const dateField = await prisma.field.findFirstOrThrow({
      where: {
        envelopeId: envelope.id,
        type: FieldType.DATE,
      },
    });

    expect(dateField.inserted).toBe(true);
    expect(dateField.customText).toBeTruthy();

    const insertedDate = DateTime.fromFormat(dateField.customText, DEFAULT_DOCUMENT_DATE_FORMAT, {
      zone: DEFAULT_DOCUMENT_TIME_ZONE,
    });

    expect(insertedDate.isValid).toBe(true);
    expect(Math.abs(insertedDate.diff(now, 'minutes').minutes)).toBeLessThanOrEqual(2);

    // Verify the email field was inserted with the recipient's email.
    const emailField = await prisma.field.findFirstOrThrow({
      where: {
        envelopeId: envelope.id,
        type: FieldType.EMAIL,
      },
    });

    expect(emailField.inserted).toBe(true);
    expect(emailField.customText).toBe(recipientEmail);

    // Verify all fields are inserted.
    const allFields = await prisma.field.findMany({
      where: { envelopeId: envelope.id },
    });

    for (const field of allFields) {
      expect(field.inserted).toBe(true);
    }

    // Verify the document reached COMPLETED status.
    await expect(async () => {
      const dbEnvelope = await prisma.envelope.findUniqueOrThrow({
        where: { id: envelope.id },
      });

      expect(dbEnvelope.status).toBe(DocumentStatus.COMPLETED);
    }).toPass();
  });

  test('an auto-inserted number field can be edited and removed', async ({ page, request }) => {
    // The default value is inserted into the field when the document is sent.
    const { envelope, distributeResult } = await apiSeedPendingDocument(request, {
      recipients: [{ email: 'signer-number@test.documenso.com', name: 'Number Signer' }],
      fieldsPerRecipient: [
        [
          { type: FieldType.SIGNATURE, page: 1, positionX: 5, positionY: 5, width: 20, height: 5 },
          {
            type: FieldType.NUMBER,
            page: 1,
            positionX: 5,
            positionY: 20,
            width: 30,
            height: 5,
            fieldMeta: { type: 'number', value: '144' },
          },
        ],
      ],
    });

    const numberField = envelope.fields.find((field) => field.type === FieldType.NUMBER);

    if (!numberField) {
      throw new Error('Number field not found');
    }

    await page.goto(`/sign/${distributeResult.recipients[0].token}`);
    await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

    const canvas = getPageCanvas(page);
    await expect(canvas).toBeVisible({ timeout: 30_000 });

    const canvasBox = await getCanvasBox(page);

    // Field positions and sizes are percentages of the page.
    const numberFieldCenter = {
      x: ((Number(numberField.positionX) + Number(numberField.width) / 2) / 100) * canvasBox.width,
      y: ((Number(numberField.positionY) + Number(numberField.height) / 2) / 100) * canvasBox.height,
    };

    const dialog = page.getByRole('dialog');
    const numberInput = dialog.getByRole('textbox');

    await expect.poll(() => getKonvaFieldTextForPage(page, 1, numberField.id)).toBe('144');

    await canvas.click({ position: numberFieldCenter });
    await expect(numberInput).toHaveValue('144');
    await numberInput.fill('145');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => getKonvaFieldTextForPage(page, 1, numberField.id)).toBe('145');

    const editedNumberField = await prisma.field.findUniqueOrThrow({ where: { id: numberField.id } });

    expect(editedNumberField.inserted).toBe(true);
    expect(editedNumberField.customText).toBe('145');

    await canvas.click({ position: numberFieldCenter });
    await expect(numberInput).toHaveValue('145');
    await dialog.getByRole('button', { name: 'Remove' }).click();
    await expect.poll(() => getKonvaFieldTextForPage(page, 1, numberField.id)).toBe('Number');

    const removedNumberField = await prisma.field.findUniqueOrThrow({ where: { id: numberField.id } });

    expect(removedNumberField.inserted).toBe(false);
    expect(removedNumberField.customText).toBe('');
  });
});
