import { expect, test } from '@playwright/test';
import { DocumentStatus, FieldType } from '@prisma/client';
import { DateTime } from 'luxon';

import { PDF_PAGE_SELECTOR } from '@documenso/app-tests/e2e/pdf-viewer/pdf-viewer.spec';
import { DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

test.describe('V2 envelope field insertion during signing', () => {
  test('date fields are auto-inserted when completing a V2 envelope', async ({ page }) => {
    const { user, team } = await seedUser();

    const now = DateTime.now().setZone(DEFAULT_DOCUMENT_TIME_ZONE);

    const { document, recipients } = await seedPendingDocumentWithFullFields({
      teamId: team.id,
      owner: user,
      recipients: ['signer-date@test.documenso.com'],
      fields: [FieldType.DATE],
      updateDocumentOptions: { internalVersion: 2 },
    });

    const { token } = recipients[0];

    await page.goto(`/sign/${token}`);

    // V2 signing page shows the envelope title in the hea
    // Date fields are auto-filled, so "0 Fields Remaining" should be shown
    // and the Complete button should be immediately available.
    await expect(page.getByText('0 Fields Remaining').first()).toBeVisible();

    // wait for PDF to be visible
    await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Complete' }).click();
    await expect(page.getByRole('heading', { name: 'Are you sure?' })).toBeVisible();
    await page.getByRole('button', { name: 'Sign' }).click();

    await page.waitForURL(`/sign/${token}/complete`);
    await expect(page.getByText('Document Signed')).toBeVisible();

    // Verify the date field was inserted in the database with the correct format.
    const dateField = await prisma.field.findFirstOrThrow({
      where: {
        envelopeId: document.id,
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
      const envelope = await prisma.envelope.findUniqueOrThrow({
        where: { id: document.id },
      });

      expect(envelope.status).toBe(DocumentStatus.COMPLETED);
    }).toPass();
  });

  test('date and email fields are inserted when completing a V2 envelope with multiple field types', async ({
    page,
  }) => {
    const { user, team } = await seedUser();

    const now = DateTime.now().setZone(DEFAULT_DOCUMENT_TIME_ZONE);

    const { document, recipients } = await seedPendingDocumentWithFullFields({
      teamId: team.id,
      owner: user,
      recipients: ['signer-multi@test.documenso.com'],
      fields: [FieldType.DATE, FieldType.EMAIL, FieldType.NAME, FieldType.SIGNATURE],
      updateDocumentOptions: { internalVersion: 2 },
    });

    const { token, fields } = recipients[0];

    await page.goto(`/sign/${token}`);

    // wait for PDF to be visible
    await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

    // Wait for the Konva canvas to be ready.
    const canvas = page.locator('.konva-container canvas').first();
    await expect(canvas).toBeVisible({ timeout: 30_000 });

    // The date field is auto-filled, so only EMAIL, NAME, and SIGNATURE remain.
    // That means 3 fields remaining.
    await expect(page.getByText('3 Fields Remaining').first()).toBeVisible();

    // Set up a signature via the sidebar form.
    await page.getByTestId('signature-pad-dialog-button').click();
    await page.getByRole('tab', { name: 'Type' }).click();
    await page.getByTestId('signature-pad-type-input').fill('Signature');
    await page.getByRole('button', { name: 'Next' }).click();

    // Click each non-date field on the Konva canvas to insert it.
    // Fields are seeded with positions based on their index:
    //   positionX = (recipientIndex + 1) * 5 = 5 (as percentage)
    //   positionY = (fieldIndex + 1) * 5 (as percentage)
    // DATE is index 0 (positionY=5%), EMAIL is index 1 (positionY=10%),
    // NAME is index 2 (positionY=15%), SIGNATURE is index 3 (positionY=20%).
    //
    // We need to convert these percentages to pixel positions on the canvas.
    const canvasBox = await canvas.boundingBox();

    if (!canvasBox) {
      throw new Error('Canvas bounding box not found');
    }

    const nonDateFields = fields.filter((f) => f.type !== FieldType.DATE);

    for (const field of nonDateFields) {
      const x =
        (Number(field.positionX) / 100) * canvasBox.width +
        ((Number(field.width) / 100) * canvasBox.width) / 2;
      const y =
        (Number(field.positionY) / 100) * canvasBox.height +
        ((Number(field.height) / 100) * canvasBox.height) / 2;

      await canvas.click({ position: { x, y } });

      // EMAIL and NAME fields may open a dialog — handle accordingly.
      if (field.type === FieldType.EMAIL) {
        // The email dialog may pre-fill with the recipient's email. Click Save/confirm.
        const emailDialog = page.getByRole('dialog');
        const isDialogVisible = await emailDialog.isVisible().catch(() => false);

        if (isDialogVisible) {
          // Fill the email if the input is empty or visible.
          const emailInput = emailDialog
            .locator('input[type="email"], input[name="email"]')
            .first();
          const isInputVisible = await emailInput.isVisible().catch(() => false);

          if (isInputVisible) {
            await emailInput.fill('signer-multi@test.documenso.com');
          }

          const saveButton = emailDialog.getByRole('button', { name: 'Save' });
          const isButtonVisible = await saveButton.isVisible().catch(() => false);

          if (isButtonVisible) {
            await saveButton.click();
          }
        }
      }

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
        envelopeId: document.id,
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
        envelopeId: document.id,
        type: FieldType.EMAIL,
      },
    });

    expect(emailField.inserted).toBe(true);
    expect(emailField.customText).toBe('signer-multi@test.documenso.com');

    // Verify all fields are inserted.
    const allFields = await prisma.field.findMany({
      where: { envelopeId: document.id },
    });

    for (const field of allFields) {
      expect(field.inserted).toBe(true);
    }

    // Verify the document reached COMPLETED status.
    await expect(async () => {
      const envelope = await prisma.envelope.findUniqueOrThrow({
        where: { id: document.id },
      });

      expect(envelope.status).toBe(DocumentStatus.COMPLETED);
    }).toPass();
  });
});
