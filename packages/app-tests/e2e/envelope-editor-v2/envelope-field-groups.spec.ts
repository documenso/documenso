import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { expect, type Page, test } from '@playwright/test';
import { type Field, FieldType } from '@prisma/client';

import {
  addEnvelopeItemPdf,
  changeSelectedFieldType,
  clickAddMyselfButton,
  clickEnvelopeEditorStep,
  createFieldSettingsGroup,
  getEnvelopeEditorSettingsTrigger,
  getFieldActionToolbarButton,
  getFieldSettingsExternalIdInput,
  getFieldSettingsGroupIdInput,
  getFieldSettingsGroupSuggestions,
  getFieldSettingsHideLabelCheckbox,
  getFieldsCanvas,
  getRecipientEmailInputs,
  openDocumentEnvelopeEditor,
  openEmbeddedEnvelopeEditor,
  openFieldSettingsAdvancedSection,
  openTemplateEnvelopeEditor,
  persistEmbeddedEnvelope,
  placeFieldOnCanvas,
  selectFieldOnCanvas,
  selectFieldSettingsGroupSuggestion,
  setFieldSettingsExternalId,
  setFieldSettingsGroupId,
  setRecipientEmail,
  setRecipientName,
  type TCanvasPosition,
  type TEnvelopeEditorSurface,
} from '../fixtures/envelope-editor';
import { expectToastTextToBeVisible } from '../fixtures/generic';
import { getKonvaElementCountForPage } from '../fixtures/konva';

type TFlowResult = {
  externalId: string;
};

const TEST_VALUES = {
  embeddedRecipient: {
    email: 'embedded-field-group-recipient@documenso.com',
    name: 'Embedded Field Group Recipient',
  },
  conflictingGroupError: 'This group ID is used by fields of a different type or recipient',
  validationRemovedToast: 'Group validation removed',
  saveFailedToast: 'Save failed',
};

/**
 * Fields are placed 90x30px around the click point, so rows 100px apart never overlap.
 */
const POSITIONS = {
  rowOne: { x: 150, y: 120 },
  rowTwo: { x: 150, y: 220 },
  rowThree: { x: 150, y: 320 },
  rowFour: { x: 150, y: 420 },
  rowFive: { x: 150, y: 520 },
} satisfies Record<string, TCanvasPosition>;

/**
 * Duplicated fields are offset by 3% of the page. Fields are 30px tall, so a point ~25px
 * below the original row centre lands inside the clone but outside the original.
 */
const DUPLICATE_RADIO_POSITION: TCanvasPosition = { x: POSITIONS.rowFour.x + 18, y: POSITIONS.rowFour.y + 28 };

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
    await surface.root.getByTestId('toast-close').click();
  }
};

const setupRecipientForFieldPlacement = async (surface: TEnvelopeEditorSurface) => {
  if (surface.isEmbedded) {
    await setRecipientEmail(surface.root, 0, TEST_VALUES.embeddedRecipient.email);
    await setRecipientName(surface.root, 0, TEST_VALUES.embeddedRecipient.name);

    return;
  }

  await clickAddMyselfButton(surface.root);
  await expect(getRecipientEmailInputs(surface.root).first()).toHaveValue(surface.userEmail);
};

/**
 * Shared setup: set the envelope external ID, add a recipient and open the fields step.
 */
const prepareFieldsStep = async (surface: TEnvelopeEditorSurface, externalIdPrefix: string) => {
  const externalId = `${externalIdPrefix}-${nanoid()}`;

  if (surface.isEmbedded && !surface.envelopeId) {
    await addEnvelopeItemPdf(surface.root, 'embedded-field-groups.pdf');
  }

  await updateExternalId(surface, externalId);
  await setupRecipientForFieldPlacement(surface);

  await clickEnvelopeEditorStep(surface.root, 'addFields');
  await expect(surface.root.getByText('Selected Recipient')).toBeVisible();
  await expect(getFieldsCanvas(surface.root)).toBeVisible();

  return externalId;
};

/**
 * Navigates away from and back to the fields step so the editor re-renders from the
 * saved state.
 */
const reloadFieldsStep = async (root: Page) => {
  await clickEnvelopeEditorStep(root, 'upload');
  await expect(root.getByRole('heading', { name: 'Recipients' })).toBeVisible();

  await clickEnvelopeEditorStep(root, 'addFields');
  await expect(getFieldsCanvas(root)).toBeVisible();
};

const findEnvelopeFields = async (surface: TEnvelopeEditorSurface, externalId: string) => {
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

  // Order by vertical position so fields map back to the rows they were placed on.
  return [...envelope.fields].sort((a, b) => Number(a.positionY) - Number(b.positionY));
};

const getFieldMeta = (field: Field): Record<string, unknown> => {
  expect(field.fieldMeta).not.toBeNull();

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return field.fieldMeta as Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Flow 1: Advanced section basics (external ID, hide label, groupable types)
// ---------------------------------------------------------------------------

const ADVANCED_VALUES = {
  label: 'Company',
  externalId: 'ext-company-field',
};

const runAdvancedSectionFlow = async (surface: TEnvelopeEditorSurface): Promise<TFlowResult> => {
  const root = surface.root;
  const externalId = await prepareFieldsStep(surface, 'e2e-field-advanced');

  // Text field: has a label but no hide label toggle, which is only for option fields.
  await placeFieldOnCanvas(root, 'Text', POSITIONS.rowOne);
  await root.getByTestId('field-form-label').fill(ADVANCED_VALUES.label);
  await expect(getFieldSettingsHideLabelCheckbox(root)).toHaveCount(0);

  await setFieldSettingsExternalId(root, ADVANCED_VALUES.externalId);
  await expect(getFieldSettingsGroupIdInput(root)).toBeVisible();

  // Signature field: can have an external ID but cannot be grouped.
  await placeFieldOnCanvas(root, 'Signature', POSITIONS.rowTwo);
  await openFieldSettingsAdvancedSection(root);
  await expect(getFieldSettingsExternalIdInput(root)).toBeVisible();
  await expect(getFieldSettingsGroupIdInput(root)).toHaveCount(0);

  // Checkbox field: has no label but can hide its option labels.
  await placeFieldOnCanvas(root, 'Checkbox', POSITIONS.rowThree);
  await expect(root.getByTestId('field-form-label')).toHaveCount(0);
  await expect(root.getByText('Hide Option Labels')).toBeVisible();
  await getFieldSettingsHideLabelCheckbox(root).click();

  // Reload and confirm the settings survived.
  await reloadFieldsStep(root);
  expect(await getKonvaElementCountForPage(root, 1, '.field-group')).toBe(3);

  await selectFieldOnCanvas(root, POSITIONS.rowOne);
  await expect(root.getByTestId('field-form-label')).toHaveValue(ADVANCED_VALUES.label);

  await openFieldSettingsAdvancedSection(root);
  await expect(getFieldSettingsExternalIdInput(root)).toHaveValue(ADVANCED_VALUES.externalId);

  await selectFieldOnCanvas(root, POSITIONS.rowThree);
  await expect(getFieldSettingsHideLabelCheckbox(root)).toHaveAttribute('data-state', 'checked');

  return { externalId };
};

const assertAdvancedSectionPersisted = async (surface: TEnvelopeEditorSurface, externalId: string) => {
  const [textField, signatureField, checkboxField] = await findEnvelopeFields(surface, externalId);

  expect(textField.type).toBe(FieldType.TEXT);
  expect(textField.externalId).toBe(ADVANCED_VALUES.externalId);
  expect(textField.groupId).toBeNull();
  expect(getFieldMeta(textField).label).toBe(ADVANCED_VALUES.label);
  expect(getFieldMeta(textField).hideLabel).toBeUndefined();

  expect(signatureField.type).toBe(FieldType.SIGNATURE);
  expect(signatureField.externalId).toBeNull();
  expect(signatureField.groupId).toBeNull();

  expect(checkboxField.type).toBe(FieldType.CHECKBOX);
  expect(getFieldMeta(checkboxField).hideLabel).toBe(true);
};

// ---------------------------------------------------------------------------
// Flow 2: Create, join and leave a group
// ---------------------------------------------------------------------------

type TGroupMembershipFlowResult = TFlowResult & {
  groupId: string;
};

const runGroupMembershipFlow = async (surface: TEnvelopeEditorSurface): Promise<TGroupMembershipFlowResult> => {
  const root = surface.root;
  const externalId = await prepareFieldsStep(surface, 'e2e-field-group-membership');

  // Three text fields and a checkbox which must never be offered the text group.
  await placeFieldOnCanvas(root, 'Text', POSITIONS.rowOne);
  await placeFieldOnCanvas(root, 'Text', POSITIONS.rowTwo);
  await placeFieldOnCanvas(root, 'Text', POSITIONS.rowThree);
  await placeFieldOnCanvas(root, 'Checkbox', POSITIONS.rowFour);

  // Field A: make it required and create a group for it.
  await selectFieldOnCanvas(root, POSITIONS.rowOne);
  await root.getByTestId('field-form-required').click();

  const groupId = await createFieldSettingsGroup(root);

  // Field B: join by typing the ID. The suggestion lists the single existing member and
  // B adopts the group's shared settings.
  await selectFieldOnCanvas(root, POSITIONS.rowTwo);
  await expect(root.getByTestId('field-form-required')).toHaveAttribute('data-state', 'unchecked');

  await openFieldSettingsAdvancedSection(root);
  await getFieldSettingsGroupIdInput(root).click();
  await expect(getFieldSettingsGroupSuggestions(root).filter({ hasText: groupId })).toContainText('1 item');

  await setFieldSettingsGroupId(root, groupId);
  await expect(root.getByTestId('field-form-required')).toHaveAttribute('data-state', 'checked');

  // Field C: join from the suggestion list, which now shows two members.
  await selectFieldOnCanvas(root, POSITIONS.rowThree);
  await openFieldSettingsAdvancedSection(root);
  await getFieldSettingsGroupIdInput(root).click();
  await expect(getFieldSettingsGroupSuggestions(root).filter({ hasText: groupId })).toContainText('2 items');
  await root.keyboard.press('Escape');

  await selectFieldSettingsGroupSuggestion(root, groupId);

  // Checkbox: the text group is not suggested, and typing it is rejected.
  await selectFieldOnCanvas(root, POSITIONS.rowFour);
  await openFieldSettingsAdvancedSection(root);
  await getFieldSettingsGroupIdInput(root).click();
  await expect(getFieldSettingsGroupSuggestions(root).filter({ hasText: groupId })).toHaveCount(0);
  await expect(getFieldSettingsGroupSuggestions(root).filter({ hasText: 'Create Group' })).toHaveCount(1);
  await root.keyboard.press('Escape');

  await setFieldSettingsGroupId(root, groupId);
  await expect(root.getByText(TEST_VALUES.conflictingGroupError)).toBeVisible();

  // Field C leaves the group.
  await selectFieldOnCanvas(root, POSITIONS.rowThree);
  await setFieldSettingsGroupId(root, '');

  // Reload and confirm membership survived.
  await reloadFieldsStep(root);

  await selectFieldOnCanvas(root, POSITIONS.rowOne);
  await openFieldSettingsAdvancedSection(root);
  await expect(getFieldSettingsGroupIdInput(root)).toHaveValue(groupId);

  await selectFieldOnCanvas(root, POSITIONS.rowThree);
  await openFieldSettingsAdvancedSection(root);
  await expect(getFieldSettingsGroupIdInput(root)).toHaveValue('');

  return { externalId, groupId };
};

const assertGroupMembershipPersisted = async (
  surface: TEnvelopeEditorSurface,
  { externalId, groupId }: TGroupMembershipFlowResult,
) => {
  const [fieldA, fieldB, fieldC, checkboxField] = await findEnvelopeFields(surface, externalId);

  expect(fieldA.groupId).toBe(groupId);
  expect(fieldB.groupId).toBe(groupId);
  expect(fieldC.groupId).toBeNull();

  expect(checkboxField.type).toBe(FieldType.CHECKBOX);
  expect(checkboxField.groupId).toBeNull();

  expect(getFieldMeta(fieldA).required).toBe(true);
  expect(getFieldMeta(fieldB).required).toBe(true);
};

// ---------------------------------------------------------------------------
// Flow 3: Shared settings stay in sync across a group
// ---------------------------------------------------------------------------

type TSharedSettingsFlowResult = TFlowResult & {
  checkboxGroupId: string;
  radioGroupId: string;
};

const SHARED_SETTINGS_VALUES = {
  validationRule: 'Select at least',
  validationLength: 2,
  fontSize: '20',
};

const runSharedSettingsFlow = async (surface: TEnvelopeEditorSurface): Promise<TSharedSettingsFlowResult> => {
  const root = surface.root;
  const externalId = await prepareFieldsStep(surface, 'e2e-field-group-sync');

  // Checkbox group of three.
  await placeFieldOnCanvas(root, 'Checkbox', POSITIONS.rowOne);
  const checkboxGroupId = await createFieldSettingsGroup(root);

  await placeFieldOnCanvas(root, 'Checkbox', POSITIONS.rowTwo);
  await selectFieldSettingsGroupSuggestion(root, checkboxGroupId);

  await placeFieldOnCanvas(root, 'Checkbox', POSITIONS.rowThree);
  await selectFieldSettingsGroupSuggestion(root, checkboxGroupId);

  // Edit A: the validation rule and required flag sync, the font size does not.
  await selectFieldOnCanvas(root, POSITIONS.rowOne);

  await root.getByTestId('field-form-validationRule').click();
  await root.getByRole('option', { name: SHARED_SETTINGS_VALUES.validationRule }).click();
  await root.getByTestId('field-form-validationLength').click();
  await root.getByRole('option', { name: String(SHARED_SETTINGS_VALUES.validationLength), exact: true }).click();

  await root.getByTestId('field-form-required').click();
  await root.getByTestId('field-form-fontSize').fill(SHARED_SETTINGS_VALUES.fontSize);

  // Radio group of two, each with a checked option. Only one may remain checked.
  await placeFieldOnCanvas(root, 'Radio', POSITIONS.rowFour);
  await root.getByTestId('field-form-values-0-checked').click();
  const radioGroupId = await createFieldSettingsGroup(root);

  await placeFieldOnCanvas(root, 'Radio', POSITIONS.rowFive);
  await selectFieldSettingsGroupSuggestion(root, radioGroupId);
  await root.getByTestId('field-form-values-0-checked').click();

  // Reload and confirm the sync is reflected in the sidebar for a sibling.
  await reloadFieldsStep(root);

  await selectFieldOnCanvas(root, POSITIONS.rowTwo);
  await expect(root.getByTestId('field-form-required')).toHaveAttribute('data-state', 'checked');
  await expect(root.getByTestId('field-form-validationLength')).toContainText(
    String(SHARED_SETTINGS_VALUES.validationLength),
  );

  await selectFieldOnCanvas(root, POSITIONS.rowFour);
  await expect(root.getByTestId('field-form-values-0-checked')).toHaveAttribute('data-state', 'unchecked');

  return { externalId, checkboxGroupId, radioGroupId };
};

const assertSharedSettingsPersisted = async (
  surface: TEnvelopeEditorSurface,
  { externalId, checkboxGroupId, radioGroupId }: TSharedSettingsFlowResult,
) => {
  const fields = await findEnvelopeFields(surface, externalId);

  const checkboxFields = fields.filter((field) => field.type === FieldType.CHECKBOX);
  const radioFields = fields.filter((field) => field.type === FieldType.RADIO);

  expect(checkboxFields).toHaveLength(3);
  expect(radioFields).toHaveLength(2);

  for (const field of checkboxFields) {
    const fieldMeta = getFieldMeta(field);

    expect(field.groupId).toBe(checkboxGroupId);
    expect(fieldMeta.validationRule).toBe(SHARED_SETTINGS_VALUES.validationRule);
    expect(fieldMeta.validationLength).toBe(SHARED_SETTINGS_VALUES.validationLength);
    expect(fieldMeta.required).toBe(true);
  }

  // Only the edited field carries the visual change.
  const [checkboxA, checkboxB, checkboxC] = checkboxFields;

  expect(getFieldMeta(checkboxA).fontSize).toBe(Number(SHARED_SETTINGS_VALUES.fontSize));
  expect(getFieldMeta(checkboxB).fontSize).not.toBe(Number(SHARED_SETTINGS_VALUES.fontSize));
  expect(getFieldMeta(checkboxC).fontSize).not.toBe(Number(SHARED_SETTINGS_VALUES.fontSize));

  // The most recently checked radio wins and the sibling is unchecked.
  const [radioA, radioB] = radioFields;

  expect(radioA.groupId).toBe(radioGroupId);
  expect(radioB.groupId).toBe(radioGroupId);

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const radioAValues = getFieldMeta(radioA).values as Array<{ checked: boolean }>;
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const radioBValues = getFieldMeta(radioB).values as Array<{ checked: boolean }>;

  expect(radioAValues.some((value) => value.checked)).toBe(false);
  expect(radioBValues.some((value) => value.checked)).toBe(true);
};

// ---------------------------------------------------------------------------
// Flow 4: Invalid groups heal themselves instead of failing to save
// ---------------------------------------------------------------------------

type TGroupInvalidationFlowResult = TFlowResult & {
  checkboxGroupId: string;
  radioGroupId: string;
};

const runGroupInvalidationFlow = async (surface: TEnvelopeEditorSurface): Promise<TGroupInvalidationFlowResult> => {
  const root = surface.root;
  const externalId = await prepareFieldsStep(surface, 'e2e-field-group-invalidation');

  // Three single option checkboxes requiring at least three pooled options.
  await placeFieldOnCanvas(root, 'Checkbox', POSITIONS.rowOne);
  const checkboxGroupId = await createFieldSettingsGroup(root);

  await placeFieldOnCanvas(root, 'Checkbox', POSITIONS.rowTwo);
  await selectFieldSettingsGroupSuggestion(root, checkboxGroupId);

  await placeFieldOnCanvas(root, 'Checkbox', POSITIONS.rowThree);
  await selectFieldSettingsGroupSuggestion(root, checkboxGroupId);

  await root.getByTestId('field-form-validationRule').click();
  await root.getByRole('option', { name: 'Select at least' }).click();
  await root.getByTestId('field-form-validationLength').click();
  await root.getByRole('option', { name: '3', exact: true }).click();

  // Selecting a length adds options to the edited field to satisfy the rule on its own,
  // so trim it back to one option to rely on the pool.
  await root.getByTestId('field-form-values-2-remove').click();
  await root.getByTestId('field-form-values-1-remove').click();

  // Deleting a member drops the pool below the rule, so the rule is removed.
  await selectFieldOnCanvas(root, POSITIONS.rowThree);
  await getFieldActionToolbarButton(root, 'Remove').click();
  await expectToastTextToBeVisible(root, TEST_VALUES.validationRemovedToast);
  await root.getByTestId('toast-close').click();

  // The length select falls back to its placeholder once the rule is removed.
  await selectFieldOnCanvas(root, POSITIONS.rowOne);
  await expect(root.getByTestId('field-form-validationLength')).toContainText('Pick a number');

  // Re-apply "at least 3". The edited field gains two options so the pool is four, then
  // removing options in the sidebar drops the pool below the rule again.
  await root.getByTestId('field-form-validationRule').click();
  await root.getByRole('option', { name: 'Select at least' }).click();
  await root.getByTestId('field-form-validationLength').click();
  await root.getByRole('option', { name: '3', exact: true }).click();

  await root.getByTestId('field-form-values-2-remove').click();
  await expect(root.getByText(TEST_VALUES.validationRemovedToast)).toHaveCount(0);

  await root.getByTestId('field-form-values-1-remove').click();
  await expectToastTextToBeVisible(root, TEST_VALUES.validationRemovedToast);
  await root.getByTestId('toast-close').click();

  // Changing the type of a grouped field removes it from the group.
  await selectFieldOnCanvas(root, POSITIONS.rowTwo);
  await changeSelectedFieldType(root, 'Text');
  await openFieldSettingsAdvancedSection(root);
  await expect(getFieldSettingsGroupIdInput(root)).toHaveValue('');

  // Duplicating a checked grouped radio produces an unchecked clone in the same group.
  await placeFieldOnCanvas(root, 'Radio', POSITIONS.rowFour);
  await root.getByTestId('field-form-values-0-checked').click();
  const radioGroupId = await createFieldSettingsGroup(root);

  await selectFieldOnCanvas(root, POSITIONS.rowFour);
  await getFieldActionToolbarButton(root, 'Duplicate').click();
  expect(await getKonvaElementCountForPage(root, 1, '.field-group')).toBe(4);

  // The clone is offset by 3% of the page from the original, so click just below the
  // original's bottom edge to select the clone.
  await selectFieldOnCanvas(root, DUPLICATE_RADIO_POSITION);
  await expect(root.getByTestId('field-form-values-0-checked')).toHaveAttribute('data-state', 'unchecked');
  await openFieldSettingsAdvancedSection(root);
  await expect(getFieldSettingsGroupIdInput(root)).toHaveValue(radioGroupId);

  // Nothing above should have failed to save.
  await reloadFieldsStep(root);
  await expect(root.getByText(TEST_VALUES.saveFailedToast)).toHaveCount(0);

  return { externalId, checkboxGroupId, radioGroupId };
};

const assertGroupInvalidationPersisted = async (
  surface: TEnvelopeEditorSurface,
  { externalId, checkboxGroupId, radioGroupId }: TGroupInvalidationFlowResult,
) => {
  const fields = await findEnvelopeFields(surface, externalId);

  const checkboxFields = fields.filter((field) => field.type === FieldType.CHECKBOX);
  const textFields = fields.filter((field) => field.type === FieldType.TEXT);
  const radioFields = fields.filter((field) => field.type === FieldType.RADIO);

  // One checkbox deleted, one converted to text.
  expect(checkboxFields).toHaveLength(1);
  expect(textFields).toHaveLength(1);
  expect(radioFields).toHaveLength(2);

  const [checkboxField] = checkboxFields;

  expect(checkboxField.groupId).toBe(checkboxGroupId);

  // The settings form stores a removed rule as empty values.
  expect(getFieldMeta(checkboxField).validationRule).toBeFalsy();
  expect(getFieldMeta(checkboxField).validationLength).toBeFalsy();

  expect(textFields[0].groupId).toBeNull();

  for (const field of radioFields) {
    expect(field.groupId).toBe(radioGroupId);
  }

  const checkedRadioCount = radioFields.filter((field) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const values = getFieldMeta(field).values as Array<{ checked: boolean }>;

    return values.some((value) => value.checked);
  }).length;

  expect(checkedRadioCount).toBe(1);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('document editor', () => {
  test('field advanced settings: external ID, hide label and groupable types', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const { externalId } = await runAdvancedSectionFlow(surface);

    await assertAdvancedSectionPersisted(surface, externalId);
  });

  test('create, join and leave a field group', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const result = await runGroupMembershipFlow(surface);

    await assertGroupMembershipPersisted(surface, result);
  });

  test('shared settings stay in sync across a field group', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const result = await runSharedSettingsFlow(surface);

    await assertSharedSettingsPersisted(surface, result);
  });

  test('invalid field groups heal themselves instead of failing to save', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const result = await runGroupInvalidationFlow(surface);

    await assertGroupInvalidationPersisted(surface, result);
  });
});

test.describe('template editor', () => {
  test('field advanced settings: external ID, hide label and groupable types', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const { externalId } = await runAdvancedSectionFlow(surface);

    await assertAdvancedSectionPersisted(surface, externalId);
  });

  test('create, join and leave a field group', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const result = await runGroupMembershipFlow(surface);

    await assertGroupMembershipPersisted(surface, result);
  });

  test('shared settings stay in sync across a field group', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const result = await runSharedSettingsFlow(surface);

    await assertSharedSettingsPersisted(surface, result);
  });

  test('invalid field groups heal themselves instead of failing to save', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const result = await runGroupInvalidationFlow(surface);

    await assertGroupInvalidationPersisted(surface, result);
  });
});

test.describe('embedded create', () => {
  test('field advanced settings: external ID, hide label and groupable types', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
      tokenNamePrefix: 'e2e-embed-field-groups',
    });

    const { externalId } = await runAdvancedSectionFlow(surface);

    await persistEmbeddedEnvelope(surface);
    await assertAdvancedSectionPersisted(surface, externalId);
  });

  test('create, join and leave a field group', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
      tokenNamePrefix: 'e2e-embed-field-groups',
    });

    const result = await runGroupMembershipFlow(surface);

    await persistEmbeddedEnvelope(surface);
    await assertGroupMembershipPersisted(surface, result);
  });

  test('shared settings stay in sync across a field group', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
      tokenNamePrefix: 'e2e-embed-field-groups',
    });

    const result = await runSharedSettingsFlow(surface);

    await persistEmbeddedEnvelope(surface);
    await assertSharedSettingsPersisted(surface, result);
  });

  test('invalid field groups heal themselves instead of failing to save', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
      tokenNamePrefix: 'e2e-embed-field-groups',
    });

    const result = await runGroupInvalidationFlow(surface);

    await persistEmbeddedEnvelope(surface);
    await assertGroupInvalidationPersisted(surface, result);
  });
});

test.describe('embedded edit', () => {
  test('field advanced settings: external ID, hide label and groupable types', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'TEMPLATE',
      mode: 'edit',
      tokenNamePrefix: 'e2e-embed-field-groups',
    });

    const { externalId } = await runAdvancedSectionFlow(surface);

    await persistEmbeddedEnvelope(surface);
    await assertAdvancedSectionPersisted(surface, externalId);
  });

  test('create, join and leave a field group', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'TEMPLATE',
      mode: 'edit',
      tokenNamePrefix: 'e2e-embed-field-groups',
    });

    const result = await runGroupMembershipFlow(surface);

    await persistEmbeddedEnvelope(surface);
    await assertGroupMembershipPersisted(surface, result);
  });

  test('shared settings stay in sync across a field group', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'TEMPLATE',
      mode: 'edit',
      tokenNamePrefix: 'e2e-embed-field-groups',
    });

    const result = await runSharedSettingsFlow(surface);

    await persistEmbeddedEnvelope(surface);
    await assertSharedSettingsPersisted(surface, result);
  });

  test('invalid field groups heal themselves instead of failing to save', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'TEMPLATE',
      mode: 'edit',
      tokenNamePrefix: 'e2e-embed-field-groups',
    });

    const result = await runGroupInvalidationFlow(surface);

    await persistEmbeddedEnvelope(surface);
    await assertGroupInvalidationPersisted(surface, result);
  });
});
