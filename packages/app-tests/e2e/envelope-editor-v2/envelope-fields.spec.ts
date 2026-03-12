import { type Page, expect, test } from '@playwright/test';
import { FieldType } from '@prisma/client';

import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';

import {
  type TEnvelopeEditorSurface,
  addEnvelopeItemPdf,
  clickAddMyselfButton,
  clickAddSignerButton,
  clickEnvelopeEditorStep,
  getEnvelopeEditorSettingsTrigger,
  getRecipientEmailInputs,
  getRecipientRemoveButtons,
  openDocumentEnvelopeEditor,
  openEmbeddedEnvelopeEditor,
  openTemplateEnvelopeEditor,
  persistEmbeddedEnvelope,
  setRecipientEmail,
  setRecipientName,
} from '../fixtures/envelope-editor';
import { expectToastTextToBeVisible } from '../fixtures/generic';
import { getKonvaElementCountForPage } from '../fixtures/konva';

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

type FieldButtonName =
  | 'Signature'
  | 'Email'
  | 'Name'
  | 'Initials'
  | 'Date'
  | 'Text'
  | 'Number'
  | 'Radio'
  | 'Checkbox'
  | 'Dropdown';

const placeFieldOnPdf = async (
  root: Page,
  fieldName: FieldButtonName,
  position: { x: number; y: number },
) => {
  await root.getByRole('button', { name: fieldName, exact: true }).click();

  const canvas = root.locator('.konva-container canvas').first();
  await expect(canvas).toBeVisible();
  await canvas.click({ position });
};

const selectRecipientInFieldsStep = async (root: Page, recipientIdentifier: string) => {
  await root.locator('button[role="combobox"]').click();
  await root.getByText(recipientIdentifier).click();
};

const selectFieldOnCanvas = async (root: Page, position: { x: number; y: number }) => {
  const canvas = root.locator('.konva-container canvas').first();
  await expect(canvas).toBeVisible();
  await root.waitForTimeout(300);
  // Use force:true to bypass any floating action toolbar buttons that may intercept clicks.
  await canvas.click({ position, force: true });
};

const runAddAndPersistSignatureTextFields = async (
  surface: TEnvelopeEditorSurface,
): Promise<TFieldFlowResult> => {
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
  let fieldCount = await getKonvaElementCountForPage(surface.root, 1, '.field-group');
  expect(fieldCount).toBe(1);

  await placeFieldOnPdf(surface.root, 'Text', { x: 220, y: 240 });
  fieldCount = await getKonvaElementCountForPage(surface.root, 1, '.field-group');
  expect(fieldCount).toBe(2);

  await clickEnvelopeEditorStep(surface.root, 'upload');
  await expect(surface.root.getByRole('heading', { name: 'Recipients' })).toBeVisible();

  await clickEnvelopeEditorStep(surface.root, 'addFields');
  await surface.root.locator('.konva-container canvas').first().waitFor({ state: 'visible' });
  await expect(surface.root.getByText('Selected Recipient')).toBeVisible();
  fieldCount = await getKonvaElementCountForPage(surface.root, 1, '.field-group');
  expect(fieldCount).toBe(2);

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

// --- Multi-recipient field flow ---

type TMultiRecipientFlowResult = {
  externalId: string;
  firstRecipientEmail: string;
  secondRecipientEmail: string;
};

const MULTI_RECIPIENT_VALUES = {
  secondSigner: {
    email: 'second-signer@test.documenso.com',
    name: 'Second Signer',
  },
};

const runMultiRecipientFieldFlow = async (
  surface: TEnvelopeEditorSurface,
): Promise<TMultiRecipientFlowResult> => {
  const externalId = `e2e-multi-recip-${nanoid()}`;
  const root = surface.root;

  if (surface.isEmbedded && !surface.envelopeId) {
    await addEnvelopeItemPdf(root, 'embedded-fields.pdf');
  }

  await updateExternalId(surface, externalId);

  // Add two recipients.
  let firstRecipientEmail: string;

  if (surface.isEmbedded) {
    await setRecipientEmail(root, 0, TEST_FIELD_VALUES.embeddedRecipient.email);
    await setRecipientName(root, 0, TEST_FIELD_VALUES.embeddedRecipient.name);
    firstRecipientEmail = TEST_FIELD_VALUES.embeddedRecipient.email;
  } else {
    await clickAddMyselfButton(root);
    firstRecipientEmail = surface.userEmail;
  }

  await clickAddSignerButton(root);
  await setRecipientEmail(root, 1, MULTI_RECIPIENT_VALUES.secondSigner.email);
  await setRecipientName(root, 1, MULTI_RECIPIENT_VALUES.secondSigner.name);

  // Navigate to fields step.
  await clickEnvelopeEditorStep(root, 'addFields');
  await expect(root.getByText('Selected Recipient')).toBeVisible();
  await expect(root.locator('.konva-container canvas').first()).toBeVisible();

  let fieldCount = await getKonvaElementCountForPage(root, 1, '.field-group');
  expect(fieldCount).toBe(0);

  // Place Signature for recipient #1 (auto-selected).
  await placeFieldOnPdf(root, 'Signature', { x: 120, y: 140 });
  fieldCount = await getKonvaElementCountForPage(root, 1, '.field-group');
  expect(fieldCount).toBe(1);

  // Switch recipient and place text field for recipient #2.
  await selectRecipientInFieldsStep(root, MULTI_RECIPIENT_VALUES.secondSigner.email);
  await placeFieldOnPdf(root, 'Text', { x: 220, y: 240 });
  fieldCount = await getKonvaElementCountForPage(root, 1, '.field-group');
  expect(fieldCount).toBe(2);

  // Navigate away and back to ensure fields are persisted in the UI.
  await clickEnvelopeEditorStep(root, 'upload');
  await clickEnvelopeEditorStep(root, 'addFields');
  fieldCount = await getKonvaElementCountForPage(root, 1, '.field-group');
  expect(fieldCount).toBe(2);

  // Phase 2: cascade deletion — go back to recipients and remove the second one.
  await clickEnvelopeEditorStep(root, 'upload');
  await expect(getRecipientEmailInputs(root)).toHaveCount(2);

  await getRecipientRemoveButtons(root).nth(1).click();
  await expect(getRecipientEmailInputs(root)).toHaveCount(1);

  // Go back to fields and verify cascade removal.
  await clickEnvelopeEditorStep(root, 'addFields');
  fieldCount = await getKonvaElementCountForPage(root, 1, '.field-group');
  expect(fieldCount).toBe(1);

  return {
    externalId,
    firstRecipientEmail,
    secondRecipientEmail: MULTI_RECIPIENT_VALUES.secondSigner.email,
  };
};

const assertMultiRecipientCascadePersistedInDatabase = async ({
  surface,
  externalId,
  firstRecipientEmail,
}: {
  surface: TEnvelopeEditorSurface;
  externalId: string;
  firstRecipientEmail: string;
  secondRecipientEmail: string;
}) => {
  const envelope = await prisma.envelope.findFirstOrThrow({
    where: {
      externalId,
      userId: surface.userId,
      teamId: surface.teamId,
      type: surface.envelopeType,
    },
    orderBy: { createdAt: 'desc' },
    include: { fields: true, recipients: true },
  });

  // After cascade deletion, only one recipient and one field should remain.
  expect(envelope.recipients).toHaveLength(1);
  expect(envelope.recipients[0].email).toBe(firstRecipientEmail);

  expect(envelope.fields).toHaveLength(1);
  expect(envelope.fields[0].type).toBe(FieldType.SIGNATURE);
  expect(envelope.fields[0].recipientId).toBe(envelope.recipients[0].id);
};

// --- All 10 field types flow ---

type TAllFieldTypesFlowResult = {
  externalId: string;
};

const runAllFieldTypesFlow = async (
  surface: TEnvelopeEditorSurface,
): Promise<TAllFieldTypesFlowResult> => {
  const externalId = `e2e-all-fields-${nanoid()}`;
  const root = surface.root;

  if (surface.isEmbedded && !surface.envelopeId) {
    await addEnvelopeItemPdf(root, 'embedded-fields.pdf');
  }

  await updateExternalId(surface, externalId);
  await setupRecipientsForFieldPlacement(surface);

  await clickEnvelopeEditorStep(root, 'addFields');
  await expect(root.locator('.konva-container canvas').first()).toBeVisible();

  // Place and configure each field type immediately after placement.
  // After placeFieldOnPdf, the sidebar shows the field's config form (field is selected in React state).

  // 1. Signature: place and set fontSize to 24.
  await placeFieldOnPdf(root, 'Signature', { x: 120, y: 50 });
  await root.locator('[data-testid="field-form-fontSize"]').fill('24');

  // 2. Email: place and set textAlign to center.
  await placeFieldOnPdf(root, 'Email', { x: 120, y: 100 });
  await root.locator('[data-testid="field-form-textAlign"]').click();
  await root.getByRole('option', { name: 'Center' }).click();

  // 3. Name: place and set textAlign to right.
  await placeFieldOnPdf(root, 'Name', { x: 120, y: 150 });
  await root.locator('[data-testid="field-form-textAlign"]').click();
  await root.getByRole('option', { name: 'Right' }).click();

  // 4. Initials: place and set fontSize to 16.
  await placeFieldOnPdf(root, 'Initials', { x: 120, y: 200 });
  await root.locator('[data-testid="field-form-fontSize"]').fill('16');

  // 5. Date: place and set textAlign to center.
  await placeFieldOnPdf(root, 'Date', { x: 120, y: 250 });
  await root.locator('[data-testid="field-form-textAlign"]').click();
  await root.getByRole('option', { name: 'Center' }).click();

  // 6. Text: place and configure label, placeholder, text, characterLimit, required.
  await placeFieldOnPdf(root, 'Text', { x: 120, y: 300 });
  await root.locator('[data-testid="field-form-label"]').fill('Test Label');
  await root.locator('[data-testid="field-form-placeholder"]').fill('Enter text here');
  await root.locator('[data-testid="field-form-text"]').fill('Default text value');
  await root.locator('[data-testid="field-form-characterLimit"]').fill('100');
  await root.locator('[data-testid="field-form-required"]').click();

  // 7. Number: place and configure label, placeholder, numberFormat, minValue, maxValue, required.
  await placeFieldOnPdf(root, 'Number', { x: 120, y: 350 });
  await root.locator('[data-testid="field-form-label"]').fill('Amount');
  await root.locator('[data-testid="field-form-placeholder"]').fill('0.00');
  await root.locator('[data-testid="field-form-numberFormat"]').click();
  await root.getByRole('option', { name: '123,456,789.00' }).click();
  await root.locator('[data-testid="field-form-minValue"]').fill('0');
  await root.locator('[data-testid="field-form-maxValue"]').fill('1000');
  await root.locator('[data-testid="field-form-required"]').click();

  // 8. Radio: place and configure two options, pre-select first, set direction to horizontal.
  await placeFieldOnPdf(root, 'Radio', { x: 120, y: 400 });

  // The first option already exists with default value "Default value". Fill it.
  await root.locator('[data-testid="field-form-values-0-value"]').fill('Option A');

  // Add a second option.
  await root.locator('[data-testid="field-form-values-add"]').click();
  await root.locator('[data-testid="field-form-values-1-value"]').fill('Option B');

  // Pre-select the first option (click its checkbox).
  await root.locator('[data-testid="field-form-values-0-checked"]').click();

  // Set direction to horizontal.
  await root.locator('[data-testid="field-form-direction"]').click();
  await root.getByRole('option', { name: 'Horizontal' }).click();

  // 9. Checkbox: place and configure two options, check both, set validation rule.
  await placeFieldOnPdf(root, 'Checkbox', { x: 120, y: 450 });

  // Fill first option value.
  await root.locator('[data-testid="field-form-values-0-value"]').fill('Check A');

  // Add a second option.
  await root.locator('[data-testid="field-form-values-add"]').click();
  await root.locator('[data-testid="field-form-values-1-value"]').fill('Check B');

  // Check both options (click their checkboxes).
  await root.locator('[data-testid="field-form-values-0-checked"]').click();
  await root.locator('[data-testid="field-form-values-1-checked"]').click();

  // Set validation: "Select at least" 1.
  await root.locator('[data-testid="field-form-validationRule"]').click();
  await root.getByRole('option', { name: 'Select at least' }).click();

  // Set validation length to 1.
  await root.locator('[data-testid="field-form-validationLength"]').click();
  await root.getByRole('option', { name: '1', exact: true }).click();

  // 10. Dropdown: place and configure two options, set default value.
  await placeFieldOnPdf(root, 'Dropdown', { x: 120, y: 500 });

  // First option already has "Option 1". Change it to "Red".
  await root.locator('[data-testid="field-form-values-0-value"]').fill('Red');

  // Add a second option.
  await root.locator('[data-testid="field-form-values-add"]').click();
  await root.locator('[data-testid="field-form-values-1-value"]').clear();
  await root.locator('[data-testid="field-form-values-1-value"]').fill('Blue');

  // Set default value to "Red".
  await root.locator('[data-testid="field-form-defaultValue"]').click();
  await root.getByRole('option', { name: 'Red' }).click();

  let fieldCount = await getKonvaElementCountForPage(root, 1, '.field-group');
  expect(fieldCount).toBe(10);

  // Wait briefly for auto-save to fire on the last configured field.
  await root.waitForTimeout(500);

  // Navigate away and back to verify persistence.
  await clickEnvelopeEditorStep(root, 'upload');
  await clickEnvelopeEditorStep(root, 'addFields');
  fieldCount = await getKonvaElementCountForPage(root, 1, '.field-group');
  expect(fieldCount).toBe(10);

  return { externalId };
};

const assertAllFieldTypesPersistedInDatabase = async ({
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
    orderBy: { createdAt: 'desc' },
    include: { fields: true },
  });

  expect(envelope.fields).toHaveLength(10);

  const fieldsByType = new Map(envelope.fields.map((f) => [f.type, f]));

  // Helper to safely access fieldMeta as a record.
  const meta = (type: FieldType): Record<string, unknown> => {
    const field = fieldsByType.get(type);
    expect(field).toBeDefined();
    const fieldMeta = field!.fieldMeta;
    expect(typeof fieldMeta).toBe('object');
    expect(fieldMeta).not.toBeNull();
    return fieldMeta as Record<string, unknown>;
  };

  // SIGNATURE
  expect(meta(FieldType.SIGNATURE).type).toBe('signature');
  expect(meta(FieldType.SIGNATURE).fontSize).toBe(24);

  // EMAIL
  expect(meta(FieldType.EMAIL).type).toBe('email');
  expect(meta(FieldType.EMAIL).textAlign).toBe('center');

  // NAME
  expect(meta(FieldType.NAME).type).toBe('name');
  expect(meta(FieldType.NAME).textAlign).toBe('right');

  // INITIALS
  expect(meta(FieldType.INITIALS).type).toBe('initials');
  expect(meta(FieldType.INITIALS).fontSize).toBe(16);

  // DATE
  expect(meta(FieldType.DATE).type).toBe('date');
  expect(meta(FieldType.DATE).textAlign).toBe('center');

  // TEXT
  expect(meta(FieldType.TEXT).type).toBe('text');
  expect(meta(FieldType.TEXT).label).toBe('Test Label');
  expect(meta(FieldType.TEXT).placeholder).toBe('Enter text here');
  expect(meta(FieldType.TEXT).text).toBe('Default text value');
  expect(meta(FieldType.TEXT).characterLimit).toBe(100);
  expect(meta(FieldType.TEXT).required).toBe(true);

  // NUMBER
  expect(meta(FieldType.NUMBER).type).toBe('number');
  expect(meta(FieldType.NUMBER).label).toBe('Amount');
  expect(meta(FieldType.NUMBER).placeholder).toBe('0.00');
  expect(meta(FieldType.NUMBER).numberFormat).toBe('123,456,789.00');
  expect(meta(FieldType.NUMBER).minValue).toBe(0);
  expect(meta(FieldType.NUMBER).maxValue).toBe(1000);
  expect(meta(FieldType.NUMBER).required).toBe(true);

  // RADIO
  expect(meta(FieldType.RADIO).type).toBe('radio');
  expect(meta(FieldType.RADIO).direction).toBe('horizontal');
  const radioValues = meta(FieldType.RADIO).values as Array<{
    value: string;
    checked: boolean;
  }>;
  expect(radioValues).toHaveLength(2);
  expect(radioValues[0].value).toBe('Option A');
  expect(radioValues[0].checked).toBe(true);
  expect(radioValues[1].value).toBe('Option B');
  expect(radioValues[1].checked).toBe(false);

  // CHECKBOX
  expect(meta(FieldType.CHECKBOX).type).toBe('checkbox');
  expect(meta(FieldType.CHECKBOX).validationRule).toBe('Select at least');
  expect(meta(FieldType.CHECKBOX).validationLength).toBe(1);
  const checkboxValues = meta(FieldType.CHECKBOX).values as Array<{
    value: string;
    checked: boolean;
  }>;
  expect(checkboxValues).toHaveLength(2);
  expect(checkboxValues[0].value).toBe('Check A');
  expect(checkboxValues[0].checked).toBe(true);
  expect(checkboxValues[1].value).toBe('Check B');
  expect(checkboxValues[1].checked).toBe(true);

  // DROPDOWN
  expect(meta(FieldType.DROPDOWN).type).toBe('dropdown');
  expect(meta(FieldType.DROPDOWN).defaultValue).toBe('Red');
  const dropdownValues = meta(FieldType.DROPDOWN).values as Array<{ value: string }>;
  expect(dropdownValues).toHaveLength(2);
  expect(dropdownValues[0].value).toBe('Red');
  expect(dropdownValues[1].value).toBe('Blue');
};

// --- Duplicate and delete fields flow ---

type TDuplicateDeleteFlowResult = {
  externalId: string;
};

const runDuplicateDeleteFieldFlow = async (
  surface: TEnvelopeEditorSurface,
): Promise<TDuplicateDeleteFlowResult> => {
  const externalId = `e2e-dup-del-${nanoid()}`;
  const root = surface.root;

  if (surface.isEmbedded && !surface.envelopeId) {
    await addEnvelopeItemPdf(root, 'embedded-fields.pdf');
  }

  await updateExternalId(surface, externalId);
  await setupRecipientsForFieldPlacement(surface);

  await clickEnvelopeEditorStep(root, 'addFields');
  await expect(root.locator('.konva-container canvas').first()).toBeVisible();

  // Place a Signature field.
  await placeFieldOnPdf(root, 'Signature', { x: 150, y: 150 });
  let fieldCount = await getKonvaElementCountForPage(root, 1, '.field-group');
  expect(fieldCount).toBe(1);

  // Select the field on canvas to show the action toolbar.
  await selectFieldOnCanvas(root, { x: 150, y: 150 });
  await expect(root.locator('button[title="Duplicate"]')).toBeVisible();

  // Duplicate the field.
  await root.locator('button[title="Duplicate"]').click();
  fieldCount = await getKonvaElementCountForPage(root, 1, '.field-group');
  expect(fieldCount).toBe(2);

  // Navigate away and back to persist changes.
  await clickEnvelopeEditorStep(root, 'upload');
  await clickEnvelopeEditorStep(root, 'addFields');
  fieldCount = await getKonvaElementCountForPage(root, 1, '.field-group');
  expect(fieldCount).toBe(2);

  // Select a field and delete it via the Remove button.
  await selectFieldOnCanvas(root, { x: 150, y: 150 });
  await expect(root.locator('button[title="Remove"]')).toBeVisible();
  await root.locator('button[title="Remove"]').click();
  fieldCount = await getKonvaElementCountForPage(root, 1, '.field-group');
  expect(fieldCount).toBe(1);

  // Navigate away and back to verify persistence.
  await clickEnvelopeEditorStep(root, 'upload');
  await clickEnvelopeEditorStep(root, 'addFields');
  fieldCount = await getKonvaElementCountForPage(root, 1, '.field-group');
  expect(fieldCount).toBe(1);

  return { externalId };
};

const assertDuplicateDeleteFieldPersistedInDatabase = async ({
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
    orderBy: { createdAt: 'desc' },
    include: { fields: true },
  });

  // After duplicating (2 fields) then deleting one, exactly 1 SIGNATURE field should remain.
  expect(envelope.fields).toHaveLength(1);
  expect(envelope.fields[0].type).toBe(FieldType.SIGNATURE);
};

// --- Test describe blocks ---

test.describe('document editor', () => {
  test('add and persist signature/text fields', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const result = await runAddAndPersistSignatureTextFields(surface);

    await assertFieldsPersistedInDatabase({
      surface,
      ...result,
    });
  });

  test('multi-recipient field placement, switching, and cascade deletion', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const result = await runMultiRecipientFieldFlow(surface);

    await assertMultiRecipientCascadePersistedInDatabase({
      surface,
      ...result,
    });
  });

  test('duplicate and delete fields via canvas action toolbar', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const result = await runDuplicateDeleteFieldFlow(surface);

    await assertDuplicateDeleteFieldPersistedInDatabase({
      surface,
      ...result,
    });
  });

  test('place and configure all 10 field types', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const result = await runAllFieldTypesFlow(surface);

    await assertAllFieldTypesPersistedInDatabase({
      surface,
      ...result,
    });
  });
});

test.describe('template editor', () => {
  test('add and persist signature/text fields', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const result = await runAddAndPersistSignatureTextFields(surface);

    await assertFieldsPersistedInDatabase({
      surface,
      ...result,
    });
  });

  test('multi-recipient field placement, switching, and cascade deletion', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const result = await runMultiRecipientFieldFlow(surface);

    await assertMultiRecipientCascadePersistedInDatabase({
      surface,
      ...result,
    });
  });

  test('duplicate and delete fields via canvas action toolbar', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const result = await runDuplicateDeleteFieldFlow(surface);

    await assertDuplicateDeleteFieldPersistedInDatabase({
      surface,
      ...result,
    });
  });

  test('place and configure all 10 field types', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const result = await runAllFieldTypesFlow(surface);

    await assertAllFieldTypesPersistedInDatabase({
      surface,
      ...result,
    });
  });
});

test.describe('embedded create', () => {
  test('add and persist signature/text fields', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
      tokenNamePrefix: 'e2e-embed-fields',
    });
    const result = await runAddAndPersistSignatureTextFields(surface);

    await persistEmbeddedEnvelope(surface);

    await assertFieldsPersistedInDatabase({
      surface,
      ...result,
    });
  });

  test('multi-recipient field placement, switching, and cascade deletion', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
      tokenNamePrefix: 'e2e-embed-multi-recip',
    });
    const result = await runMultiRecipientFieldFlow(surface);

    await persistEmbeddedEnvelope(surface);

    await assertMultiRecipientCascadePersistedInDatabase({
      surface,
      ...result,
    });
  });

  test('duplicate and delete fields via canvas action toolbar', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
      tokenNamePrefix: 'e2e-embed-dup-del',
    });
    const result = await runDuplicateDeleteFieldFlow(surface);

    await persistEmbeddedEnvelope(surface);

    await assertDuplicateDeleteFieldPersistedInDatabase({
      surface,
      ...result,
    });
  });

  test('place and configure all 10 field types', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
      tokenNamePrefix: 'e2e-embed-all-fields',
    });
    const result = await runAllFieldTypesFlow(surface);

    await persistEmbeddedEnvelope(surface);

    await assertAllFieldTypesPersistedInDatabase({
      surface,
      ...result,
    });
  });
});

test.describe('embedded edit', () => {
  test('add and persist signature/text fields', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'TEMPLATE',
      mode: 'edit',
      tokenNamePrefix: 'e2e-embed-fields',
    });
    const result = await runAddAndPersistSignatureTextFields(surface);

    await persistEmbeddedEnvelope(surface);

    await assertFieldsPersistedInDatabase({
      surface,
      ...result,
    });
  });

  test('multi-recipient field placement, switching, and cascade deletion', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'TEMPLATE',
      mode: 'edit',
      tokenNamePrefix: 'e2e-embed-multi-recip',
    });
    const result = await runMultiRecipientFieldFlow(surface);

    await persistEmbeddedEnvelope(surface);

    await assertMultiRecipientCascadePersistedInDatabase({
      surface,
      ...result,
    });
  });

  test('duplicate and delete fields via canvas action toolbar', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'TEMPLATE',
      mode: 'edit',
      tokenNamePrefix: 'e2e-embed-dup-del',
    });
    const result = await runDuplicateDeleteFieldFlow(surface);

    await persistEmbeddedEnvelope(surface);

    await assertDuplicateDeleteFieldPersistedInDatabase({
      surface,
      ...result,
    });
  });

  test('place and configure all 10 field types', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'TEMPLATE',
      mode: 'edit',
      tokenNamePrefix: 'e2e-embed-all-fields',
    });
    const result = await runAllFieldTypesFlow(surface);

    await persistEmbeddedEnvelope(surface);

    await assertAllFieldTypesPersistedInDatabase({
      surface,
      ...result,
    });
  });
});
