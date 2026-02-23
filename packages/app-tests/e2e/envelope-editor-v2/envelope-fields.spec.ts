import { type Page, expect, test } from '@playwright/test';
import { FieldType } from '@prisma/client';

import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';

import {
  type TEnvelopeEditorSurface,
  addEnvelopeItemPdf,
  clickAddMyselfButton,
  clickEnvelopeEditorStep,
  getEnvelopeEditorSettingsTrigger,
  getRecipientEmailInputs,
  openDocumentEnvelopeEditor,
  openEmbeddedEnvelopeEditor,
  openTemplateEnvelopeEditor,
  persistEmbeddedEnvelope,
  setRecipientEmail,
  setRecipientName,
} from '../fixtures/envelope-editor';
import { expectToastTextToBeVisible } from '../fixtures/generic';

type TFieldFlowResult = {
  externalId: string;
  recipientEmail: string;
};

const TEST_FIELD_VALUES = {
  embeddedRecipient: {
    email: 'embedded-field-recipient@documenso.com',
    name: 'Embedded Field Recipient',
  },
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

const setupRecipientsForFieldPlacement = async (surface: TEnvelopeEditorSurface) => {
  if (surface.isEmbedded) {
    await expect(surface.root.getByRole('button', { name: 'Add Myself' })).toHaveCount(0);
    await setRecipientEmail(surface.root, 0, TEST_FIELD_VALUES.embeddedRecipient.email);
    await setRecipientName(surface.root, 0, TEST_FIELD_VALUES.embeddedRecipient.name);

    return TEST_FIELD_VALUES.embeddedRecipient.email;
  }

  await expect(surface.root.getByRole('button', { name: 'Add Myself' })).toBeVisible();
  await clickAddMyselfButton(surface.root);
  await expect(getRecipientEmailInputs(surface.root).first()).toHaveValue(surface.userEmail);

  return surface.userEmail;
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

const runFieldFlow = async (surface: TEnvelopeEditorSurface): Promise<TFieldFlowResult> => {
  const externalId = `e2e-fields-${nanoid()}`;

  if (surface.isEmbedded && !surface.envelopeId) {
    await addEnvelopeItemPdf(surface.root, 'embedded-fields.pdf');
  }

  await updateExternalId(surface, externalId);
  const recipientEmail = await setupRecipientsForFieldPlacement(surface);

  await clickEnvelopeEditorStep(surface.root, 'addFields');
  await expect(surface.root.getByText('Selected Recipient')).toBeVisible();
  await expect(surface.root.locator('.konva-container canvas').first()).toBeVisible();

  await placeFieldOnPdf(surface.root, 'Signature', { x: 120, y: 140 });
  await expect(surface.root.getByText('1 Field')).toBeVisible();

  await placeFieldOnPdf(surface.root, 'Text', { x: 220, y: 240 });
  await expect(surface.root.getByText('2 Fields')).toBeVisible();

  await clickEnvelopeEditorStep(surface.root, 'upload');
  await expect(surface.root.getByRole('heading', { name: 'Recipients' })).toBeVisible();

  await clickEnvelopeEditorStep(surface.root, 'addFields');
  await expect(surface.root.getByText('Selected Recipient')).toBeVisible();
  await expect(surface.root.getByText('2 Fields')).toBeVisible();

  return {
    externalId,
    recipientEmail,
  };
};

const getFieldMetaType = (fieldMeta: unknown) => {
  if (!isRecord(fieldMeta)) {
    return null;
  }

  return typeof fieldMeta.type === 'string' ? fieldMeta.type : null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const assertFieldsPersistedInDatabase = async ({
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
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      fields: true,
      recipients: true,
    },
  });

  const recipient = envelope.recipients.find(
    (currentRecipient) => currentRecipient.email === recipientEmail,
  );

  expect(recipient).toBeDefined();

  const fieldTypes = envelope.fields.map((field) => field.type).sort();
  const expectedFieldTypes = [FieldType.SIGNATURE, FieldType.TEXT].sort();

  expect(envelope.fields).toHaveLength(2);
  expect(fieldTypes).toEqual(expectedFieldTypes);
  expect(new Set(envelope.fields.map((field) => field.envelopeItemId)).size).toBe(1);
  expect(envelope.fields.every((field) => field.recipientId === recipient?.id)).toBe(true);

  const signatureField = envelope.fields.find((field) => field.type === FieldType.SIGNATURE);
  const textField = envelope.fields.find((field) => field.type === FieldType.TEXT);

  expect(getFieldMetaType(signatureField?.fieldMeta)).toBe('signature');
  expect(getFieldMetaType(textField?.fieldMeta)).toBe('text');
};

test.describe('Envelope Editor V2 - Fields', () => {
  test('documents/<id>: add and persist signature/text fields', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const result = await runFieldFlow(surface);

    await assertFieldsPersistedInDatabase({
      surface,
      ...result,
    });
  });

  test('templates/<id>: add and persist signature/text fields', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const result = await runFieldFlow(surface);

    await assertFieldsPersistedInDatabase({
      surface,
      ...result,
    });
  });

  test('/embed/v2/authoring/envelope/create DOCUMENT: add and persist signature/text fields', async ({
    page,
  }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
      tokenNamePrefix: 'e2e-embed-fields',
    });
    const result = await runFieldFlow(surface);

    await persistEmbeddedEnvelope(surface);

    await assertFieldsPersistedInDatabase({
      surface,
      ...result,
    });
  });

  test('/embed/v2/authoring/envelope/edit/<id> TEMPLATE: add and persist signature/text fields', async ({
    page,
  }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'TEMPLATE',
      mode: 'edit',
      tokenNamePrefix: 'e2e-embed-fields',
    });
    const result = await runFieldFlow(surface);

    await persistEmbeddedEnvelope(surface);

    await assertFieldsPersistedInDatabase({
      surface,
      ...result,
    });
  });
});
