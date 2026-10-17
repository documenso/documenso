import { FieldType } from '@prisma/client';

import { calculateFieldGroupsPdfCell } from './field-groups-pdf-layout';

/**
 * A field to place on `assets/field-groups.pdf`.
 *
 * Used by the database seed and the E2E tests, so it must stay free of app dependencies.
 *
 * `externalId` is unique per field so tests can look fields up after creation without
 * relying on ordering.
 */
export type FieldGroupTestData = {
  type: FieldType;
  /**
   * Validated by the API, so only the keys relevant to each test case are set.
   */
  fieldMeta: Record<string, unknown>;
  page: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  groupId: string | null;
  externalId: TFieldGroupExternalId;
};

export const FIELD_GROUPS = {
  text: 'grp_text',
  number: 'grp_number',
  dropdown: 'grp_dropdown',
  name: 'grp_name',
  email: 'grp_email',
  radio: 'grp_radio',
  checkboxAtLeast: 'grp_checkbox_at_least',
  checkboxExactly: 'grp_checkbox_exactly',
  checkboxAtMost: 'grp_checkbox_at_most',
} as const;

export const FIELD_GROUP_EXTERNAL_IDS = {
  signature: 'signature',
  textA: 'text-a',
  textB: 'text-b',
  textC: 'text-c',
  textD: 'text-d',
  textOptional: 'text-optional',
  numberA: 'number-a',
  numberB: 'number-b',
  dropdownA: 'dropdown-a',
  dropdownB: 'dropdown-b',
  nameA: 'name-a',
  nameB: 'name-b',
  emailA: 'email-a',
  emailB: 'email-b',
  radioA: 'radio-a',
  radioB: 'radio-b',
  radioC: 'radio-c',
  checkboxAtLeastA: 'checkbox-at-least-a',
  checkboxAtLeastB: 'checkbox-at-least-b',
  checkboxExactlyA: 'checkbox-exactly-a',
  checkboxExactlyB: 'checkbox-exactly-b',
  checkboxAtMostA: 'checkbox-at-most-a',
  checkboxAtMostB: 'checkbox-at-most-b',
} as const;

export type TFieldGroupExternalId = (typeof FIELD_GROUP_EXTERNAL_IDS)[keyof typeof FIELD_GROUP_EXTERNAL_IDS];

const option = (id: number, value: string, checked = false) => ({ id, checked, value });

export const FIELD_GROUPS_TEST_FIELDS: FieldGroupTestData[] = [
  /**
   * PAGE 1 Signature
   */
  {
    type: FieldType.SIGNATURE,
    fieldMeta: { type: 'signature' },
    page: 1,
    ...calculateFieldGroupsPdfCell(0, 0),
    groupId: null,
    externalId: FIELD_GROUP_EXTERNAL_IDS.signature,
  },

  /**
   * PAGE 2 Text group. Member D lives on page 7.
   */
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', required: true, label: 'Company', characterLimit: 40 },
    page: 2,
    ...calculateFieldGroupsPdfCell(0, 0),
    groupId: FIELD_GROUPS.text,
    externalId: FIELD_GROUP_EXTERNAL_IDS.textA,
  },
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', required: true, label: 'Company', characterLimit: 40 },
    page: 2,
    ...calculateFieldGroupsPdfCell(0, 1),
    groupId: FIELD_GROUPS.text,
    externalId: FIELD_GROUP_EXTERNAL_IDS.textB,
  },
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', required: true, label: 'Company', characterLimit: 40, fontSize: 18 },
    page: 2,
    ...calculateFieldGroupsPdfCell(1, 0, 'full'),
    groupId: FIELD_GROUPS.text,
    externalId: FIELD_GROUP_EXTERNAL_IDS.textC,
  },
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', required: false, label: 'Notes' },
    page: 2,
    ...calculateFieldGroupsPdfCell(2, 0),
    groupId: null,
    externalId: FIELD_GROUP_EXTERNAL_IDS.textOptional,
  },

  /**
   * PAGE 3 Number group
   */
  {
    type: FieldType.NUMBER,
    fieldMeta: { type: 'number', required: true, label: 'Quantity', minValue: 1, maxValue: 100 },
    page: 3,
    ...calculateFieldGroupsPdfCell(0, 0),
    groupId: FIELD_GROUPS.number,
    externalId: FIELD_GROUP_EXTERNAL_IDS.numberA,
  },
  {
    type: FieldType.NUMBER,
    fieldMeta: { type: 'number', required: true, label: 'Quantity', minValue: 1, maxValue: 100 },
    page: 3,
    ...calculateFieldGroupsPdfCell(0, 1),
    groupId: FIELD_GROUPS.number,
    externalId: FIELD_GROUP_EXTERNAL_IDS.numberB,
  },

  /**
   * PAGE 4 Dropdown, name and email groups
   */
  {
    type: FieldType.DROPDOWN,
    fieldMeta: { type: 'dropdown', required: true, values: [{ value: 'Red' }, { value: 'Blue' }] },
    page: 4,
    ...calculateFieldGroupsPdfCell(0, 0),
    groupId: FIELD_GROUPS.dropdown,
    externalId: FIELD_GROUP_EXTERNAL_IDS.dropdownA,
  },
  {
    type: FieldType.DROPDOWN,
    fieldMeta: { type: 'dropdown', required: true, values: [{ value: 'Red' }, { value: 'Blue' }] },
    page: 4,
    ...calculateFieldGroupsPdfCell(0, 1),
    groupId: FIELD_GROUPS.dropdown,
    externalId: FIELD_GROUP_EXTERNAL_IDS.dropdownB,
  },
  {
    type: FieldType.NAME,
    fieldMeta: { type: 'name' },
    page: 4,
    ...calculateFieldGroupsPdfCell(1, 0),
    groupId: FIELD_GROUPS.name,
    externalId: FIELD_GROUP_EXTERNAL_IDS.nameA,
  },
  {
    type: FieldType.NAME,
    fieldMeta: { type: 'name' },
    page: 4,
    ...calculateFieldGroupsPdfCell(1, 1),
    groupId: FIELD_GROUPS.name,
    externalId: FIELD_GROUP_EXTERNAL_IDS.nameB,
  },
  {
    type: FieldType.EMAIL,
    fieldMeta: { type: 'email' },
    page: 4,
    ...calculateFieldGroupsPdfCell(2, 0),
    groupId: FIELD_GROUPS.email,
    externalId: FIELD_GROUP_EXTERNAL_IDS.emailA,
  },
  {
    type: FieldType.EMAIL,
    fieldMeta: { type: 'email' },
    page: 4,
    ...calculateFieldGroupsPdfCell(2, 1),
    groupId: FIELD_GROUPS.email,
    externalId: FIELD_GROUP_EXTERNAL_IDS.emailB,
  },

  /**
   * PAGE 5 Radio group. Member C has a pre-checked option, so the group is auto inserted on send.
   */
  {
    type: FieldType.RADIO,
    fieldMeta: { type: 'radio', required: true, values: [option(1, 'A1'), option(2, 'A2')] },
    page: 5,
    ...calculateFieldGroupsPdfCell(0, 0),
    groupId: FIELD_GROUPS.radio,
    externalId: FIELD_GROUP_EXTERNAL_IDS.radioA,
  },
  {
    type: FieldType.RADIO,
    fieldMeta: { type: 'radio', required: true, direction: 'horizontal', values: [option(1, 'B1'), option(2, 'B2')] },
    page: 5,
    ...calculateFieldGroupsPdfCell(0, 1),
    groupId: FIELD_GROUPS.radio,
    externalId: FIELD_GROUP_EXTERNAL_IDS.radioB,
  },
  {
    type: FieldType.RADIO,
    fieldMeta: { type: 'radio', required: true, values: [option(1, 'C1', true)] },
    page: 5,
    ...calculateFieldGroupsPdfCell(1, 0),
    groupId: FIELD_GROUPS.radio,
    externalId: FIELD_GROUP_EXTERNAL_IDS.radioC,
  },

  /**
   * PAGE 6 Checkbox groups, one per validation rule
   */
  {
    type: FieldType.CHECKBOX,
    fieldMeta: {
      type: 'checkbox',
      required: true,
      validationRule: 'Select at least',
      validationLength: 2,
      values: [option(1, 'A1'), option(2, 'A2')],
    },
    page: 6,
    ...calculateFieldGroupsPdfCell(0, 0),
    groupId: FIELD_GROUPS.checkboxAtLeast,
    externalId: FIELD_GROUP_EXTERNAL_IDS.checkboxAtLeastA,
  },
  {
    type: FieldType.CHECKBOX,
    fieldMeta: {
      type: 'checkbox',
      required: true,
      validationRule: 'Select at least',
      validationLength: 2,
      values: [option(1, 'B1'), option(2, 'B2')],
    },
    page: 6,
    ...calculateFieldGroupsPdfCell(0, 1),
    groupId: FIELD_GROUPS.checkboxAtLeast,
    externalId: FIELD_GROUP_EXTERNAL_IDS.checkboxAtLeastB,
  },
  {
    type: FieldType.CHECKBOX,
    fieldMeta: {
      type: 'checkbox',
      required: true,
      validationRule: 'Select exactly',
      validationLength: 1,
      values: [option(1, 'A1'), option(2, 'A2')],
    },
    page: 6,
    ...calculateFieldGroupsPdfCell(1, 0),
    groupId: FIELD_GROUPS.checkboxExactly,
    externalId: FIELD_GROUP_EXTERNAL_IDS.checkboxExactlyA,
  },
  {
    type: FieldType.CHECKBOX,
    fieldMeta: {
      type: 'checkbox',
      required: true,
      validationRule: 'Select exactly',
      validationLength: 1,
      values: [option(1, 'B1')],
    },
    page: 6,
    ...calculateFieldGroupsPdfCell(1, 1),
    groupId: FIELD_GROUPS.checkboxExactly,
    externalId: FIELD_GROUP_EXTERNAL_IDS.checkboxExactlyB,
  },
  {
    type: FieldType.CHECKBOX,
    fieldMeta: {
      type: 'checkbox',
      required: false,
      validationRule: 'Select at most',
      validationLength: 2,
      values: [option(1, 'A1', true), option(2, 'A2')],
    },
    page: 6,
    ...calculateFieldGroupsPdfCell(2, 0),
    groupId: FIELD_GROUPS.checkboxAtMost,
    externalId: FIELD_GROUP_EXTERNAL_IDS.checkboxAtMostA,
  },
  {
    type: FieldType.CHECKBOX,
    fieldMeta: {
      type: 'checkbox',
      required: false,
      hideLabel: true,
      validationRule: 'Select at most',
      validationLength: 2,
      values: [option(1, 'B1'), option(2, 'B2')],
    },
    page: 6,
    ...calculateFieldGroupsPdfCell(2, 1),
    groupId: FIELD_GROUPS.checkboxAtMost,
    externalId: FIELD_GROUP_EXTERNAL_IDS.checkboxAtMostB,
  },

  /**
   * PAGE 7 Cross page member of the text group
   */
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', required: true, label: 'Company', characterLimit: 40 },
    page: 7,
    ...calculateFieldGroupsPdfCell(0, 0),
    groupId: FIELD_GROUPS.text,
    externalId: FIELD_GROUP_EXTERNAL_IDS.textD,
  },
];

/**
 * Resolves a seeded field by its external ID.
 */
export const findFieldGroupTestField = <T extends { externalId?: string | null }>(
  fields: T[],
  externalId: TFieldGroupExternalId,
): T => {
  const field = fields.find((field) => field.externalId === externalId);

  if (!field) {
    throw new Error(`Field with external ID "${externalId}" not found`);
  }

  return field;
};
