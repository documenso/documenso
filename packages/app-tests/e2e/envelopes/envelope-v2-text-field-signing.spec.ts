import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { prisma } from '@documenso/prisma';
import type { TGetEnvelopeResponse } from '@documenso/trpc/server/envelope-router/get-envelope.types';
import type { APIRequestContext, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { FieldType } from '@prisma/client';

import { apiSeedPendingDocument } from '../fixtures/api-seeds';
import { getKonvaFieldTextForPage } from '../fixtures/konva';

test.describe('V2 envelope text field signing', () => {
  test('inserted text can be edited and removed', async ({ page, request }) => {
    const { envelope, token, textField } = await seedTextFieldDocument(request);

    await openSigningPage(page, token);

    const dialog = page.getByRole('dialog');
    const textInput = dialog.locator('#custom-text');

    await clickField(page, textField);
    await textInput.fill('First value');
    await dialog.getByRole('button', { name: 'Enter' }).click();
    await expect.poll(() => getKonvaFieldTextForPage(page, 1, textField.id)).toBe('First value');

    await clickField(page, textField);
    await expect(textInput).toHaveValue('First value');
    await textInput.fill('Second value');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => getKonvaFieldTextForPage(page, 1, textField.id)).toBe('Second value');

    await clickField(page, textField);
    await expect(textInput).toHaveValue('Second value');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();

    await clickField(page, textField);
    await dialog.getByRole('button', { name: 'Remove' }).click();
    await expect.poll(() => getKonvaFieldTextForPage(page, 1, textField.id)).toBe('Text');

    await clickField(page, textField);
    await expect(textInput).toHaveValue('');
    await textInput.fill('Third value');
    await dialog.getByRole('button', { name: 'Enter' }).click();
    await expect.poll(() => getKonvaFieldTextForPage(page, 1, textField.id)).toBe('Third value');

    await clickField(page, textField);
    await textInput.fill('');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => getKonvaFieldTextForPage(page, 1, textField.id)).toBe('Text');

    const dbTextField = await prisma.field.findUniqueOrThrow({ where: { id: textField.id } });

    expect(dbTextField.inserted).toBe(false);
    expect(dbTextField.customText).toBe('');

    const insertedAuditLogs = await prisma.documentAuditLog.findMany({
      where: {
        envelopeId: envelope.id,
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_INSERTED,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Saving "Second value" unchanged must not have written a second entry for it.
    expect(insertedAuditLogs.map((auditLog) => auditLog.data)).toEqual([
      expect.objectContaining({ field: { type: FieldType.TEXT, data: 'First value' } }),
      expect.objectContaining({ field: { type: FieldType.TEXT, data: 'Second value' } }),
      expect.objectContaining({ field: { type: FieldType.TEXT, data: 'Third value' } }),
    ]);
  });

  test('text over the character limit is rejected before the field is signed', async ({ page, request }) => {
    const { token, textField } = await seedTextFieldDocument(request, { type: 'text', characterLimit: 10 });

    await openSigningPage(page, token);

    const dialog = page.getByRole('dialog');
    const textInput = dialog.locator('#custom-text');

    await clickField(page, textField);
    await textInput.fill('12345678901');
    await expect(dialog.getByText('1 character over the limit')).toBeVisible();

    await dialog.getByRole('button', { name: 'Enter' }).click();
    await expect(textInput).toHaveAttribute('aria-invalid', 'true');
    await expect(textInput).toHaveAccessibleDescription('1 character over the limit');

    await textInput.fill('1234567890');
    await expect(textInput).toHaveAttribute('aria-invalid', 'false');

    await dialog.getByRole('button', { name: 'Enter' }).click();
    await expect.poll(() => getKonvaFieldTextForPage(page, 1, textField.id)).toBe('1234567890');

    const dbTextField = await prisma.field.findUniqueOrThrow({ where: { id: textField.id } });

    expect(dbTextField.inserted).toBe(true);
    expect(dbTextField.customText).toBe('1234567890');
  });
});

const seedTextFieldDocument = async (request: APIRequestContext, textFieldMeta?: Record<string, unknown>) => {
  const { envelope, distributeResult } = await apiSeedPendingDocument(request, {
    recipients: [{ email: 'signer-text@test.documenso.com', name: 'Text Signer' }],
    fieldsPerRecipient: [
      [
        { type: FieldType.SIGNATURE, page: 1, positionX: 5, positionY: 5, width: 20, height: 5 },
        { type: FieldType.TEXT, page: 1, positionX: 5, positionY: 20, width: 30, height: 5, fieldMeta: textFieldMeta },
      ],
    ],
  });

  const textField = envelope.fields.find((field) => field.type === FieldType.TEXT);

  if (!textField) {
    throw new Error('Text field not found');
  }

  return { envelope, token: distributeResult.recipients[0].token, textField };
};

const openSigningPage = async (page: Page, token: string) => {
  await page.goto(`/sign/${token}`);

  await expect(page.locator('img[data-page-number]').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.konva-container canvas').first()).toBeVisible({ timeout: 30_000 });
};

const clickField = async (page: Page, field: TGetEnvelopeResponse['fields'][number]) => {
  const canvas = page.locator('.konva-container canvas').first();
  const canvasBox = await canvas.boundingBox();

  if (!canvasBox) {
    throw new Error('Canvas bounding box not found');
  }

  // Field positions and sizes are percentages of the page.
  const x = ((Number(field.positionX) + Number(field.width) / 2) / 100) * canvasBox.width;
  const y = ((Number(field.positionY) + Number(field.height) / 2) / 100) * canvasBox.height;

  await canvas.click({ position: { x, y } });
};
