import { FieldType } from '@prisma/client';

import { toCheckboxCustomText } from '@documenso/lib/utils/fields';
import {
  CheckboxValidationRules,
  numberFormatValues,
} from '@documenso/ui/primitives/document-flow/field-items-advanced-settings/constants';

import type { FieldTestData } from './field-alignment-pdf';
import { signatureBase64Demo } from './field-alignment-pdf';

const columnWidth = 20.1;
const fullColumnWidth = 75.8;
const rowHeight = 9.8;
const rowPadding = 1.8;

const alignmentGridStartX = 11.85;
const alignmentGridStartY = 15.07;

const calculatePosition = (row: number, column: number, width: 'full' | 'column' = 'column') => {
  return {
    height: rowHeight,
    width: width === 'full' ? fullColumnWidth : columnWidth,
    positionX: alignmentGridStartX + (column ?? 0) * columnWidth,
    positionY: alignmentGridStartY + row * (rowHeight + rowPadding),
  };
};

export const FIELD_META_TEST_FIELDS: FieldTestData[] = [
  /**
   * PAGE 2 Signature
   */
  {
    type: FieldType.SIGNATURE,
    fieldMeta: {
      type: 'signature',
    },
    page: 2,
    ...calculatePosition(0, 0),
    customText: '',
    signature: signatureBase64Demo,
  },
  {
    type: FieldType.SIGNATURE,
    fieldMeta: {
      type: 'signature',
    },
    page: 2,
    ...calculatePosition(1, 0),
    customText: '',
    signature: signatureBase64Demo,
  },
  {
    type: FieldType.SIGNATURE,
    fieldMeta: {
      type: 'signature',
    },
    page: 2,
    ...calculatePosition(2, 0),
    customText: '',
    signature: 'My Signature',
  },
  {
    type: FieldType.SIGNATURE,
    fieldMeta: {
      type: 'signature',
    },
    page: 2,
    ...calculatePosition(3, 0),
    customText: '',
    signature: 'My Signature super overflow maybe',
  },

  /**
   * PAGE 3 TEXT
   */
  {
    type: FieldType.TEXT,
    fieldMeta: {
      type: 'text',
    },
    page: 3,
    ...calculatePosition(0, 0, 'full'),
    customText: 'Hello world, this is some random text that I have written here',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: {
      type: 'text',
    },
    page: 3,
    ...calculatePosition(1, 0),
    customText: 'Some text that should overflow correctly',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: {
      type: 'text',
      characterLimit: 5,
    },
    page: 3,
    ...calculatePosition(2, 0),
    customText: '12345',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: {
      type: 'text',
      placeholder: 'Demo Placeholder',
    },
    page: 3,
    ...calculatePosition(3, 0),
    customText: 'Input should have a placeholder text when clicked',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: {
      type: 'text',
      label: 'Demo Label',
    },
    page: 3,
    ...calculatePosition(3, 1),
    customText: 'Should have a label during editing and signing',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: {
      type: 'text',
      text: 'Prefilled text',
    },
    page: 3,
    ...calculatePosition(3, 2),
    customText: '',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: {
      type: 'text',
      required: true,
    },
    page: 3,
    ...calculatePosition(4, 0),
    customText: 'This is a required field',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: {
      type: 'text',
      readOnly: true,
      text: 'Some Readonly Value',
    },
    page: 3,
    ...calculatePosition(4, 1),
    customText: '',
  },
  /**
   * PAGE 4 NUMBER
   */
  {
    type: FieldType.NUMBER,
    fieldMeta: {
      type: 'number',
    },
    page: 4,
    ...calculatePosition(0, 0, 'full'),
    customText: '123456789',
  },
  {
    type: FieldType.NUMBER,
    fieldMeta: {
      type: 'number',
    },
    page: 4,
    ...calculatePosition(1, 0),
    customText: '123456789123456789123456789123456789',
  },
  {
    type: FieldType.NUMBER,
    fieldMeta: {
      type: 'number',
      minValue: 0,
      maxValue: 100,
    },
    page: 4,
    ...calculatePosition(2, 0),
    customText: '50',
  },
  {
    type: FieldType.NUMBER,
    fieldMeta: {
      type: 'number',
      numberFormat: numberFormatValues[0].value, // Todo: Envelopes - Check this.
      value: '123,456,789.00',
    },
    page: 4,
    ...calculatePosition(2, 1),
    customText: '123,456,789.00',
  },
  {
    type: FieldType.NUMBER,
    fieldMeta: {
      type: 'number',
      placeholder: 'Demo Placeholder',
    },
    page: 4,
    ...calculatePosition(3, 0),
    customText: '123456789',
  },
  {
    type: FieldType.NUMBER,
    fieldMeta: {
      type: 'number',
      label: 'Demo Label',
    },
    page: 4,
    ...calculatePosition(3, 1),
    customText: '123456789',
  },
  {
    type: FieldType.NUMBER,
    fieldMeta: {
      type: 'number',
      value: '123456789',
    },
    page: 4,
    ...calculatePosition(3, 2),
    customText: '123456789',
  },
  {
    type: FieldType.NUMBER,
    fieldMeta: {
      type: 'number',
      required: true,
    },
    page: 4,
    ...calculatePosition(4, 0),
    customText: '123456789',
  },
  {
    type: FieldType.NUMBER,
    fieldMeta: {
      type: 'number',
      readOnly: true,
      value: '123456789',
    },
    page: 4,
    ...calculatePosition(4, 1),
    customText: '',
  },

  /**
   * PAGE 5 RADIO
   */
  {
    type: FieldType.RADIO,
    fieldMeta: {
      direction: 'horizontal',
      type: 'radio',
      values: [
        { id: 1, checked: true, value: 'Option 1' },
        { id: 2, checked: false, value: 'Option 2' },
        { id: 3, checked: false, value: 'Option 3' },
      ],
    },
    page: 5,
    ...calculatePosition(0, 0, 'full'),
    customText: '0',
  },
  {
    type: FieldType.RADIO,
    fieldMeta: {
      direction: 'vertical',
      type: 'radio',
      values: [
        { id: 1, checked: false, value: 'Option 1' },
        { id: 2, checked: false, value: 'Option 2' },
        { id: 3, checked: true, value: 'Option 3' },
      ],
    },
    page: 5,
    ...calculatePosition(1, 0),
    customText: '2',
  },
  {
    type: FieldType.RADIO,
    fieldMeta: {
      direction: 'vertical',
      type: 'radio',
      required: true,
      values: [
        { id: 1, checked: false, value: 'Option 1' },
        { id: 2, checked: false, value: 'Option 2' },
        { id: 3, checked: false, value: 'Option 3' },
      ],
    },
    page: 5,
    ...calculatePosition(2, 0),
    customText: '2',
  },
  {
    type: FieldType.RADIO,
    fieldMeta: {
      direction: 'vertical',
      type: 'radio',
      readOnly: true,
      values: [
        { id: 1, checked: false, value: 'Option 1' },
        { id: 2, checked: false, value: 'Option 2' },
        { id: 3, checked: true, value: 'Option 3' },
      ],
    },
    page: 5,
    ...calculatePosition(2, 1),
    customText: '',
  },

  /**
   * PAGE 6 CHECKBOX
   */
  {
    type: FieldType.CHECKBOX,
    fieldMeta: {
      direction: 'horizontal',
      type: 'checkbox',
      values: [
        { id: 1, checked: true, value: 'Option 1' },
        { id: 2, checked: false, value: 'Option 2' },
        { id: 2, checked: false, value: 'Option 3' },
        { id: 2, checked: false, value: 'Option 4' },
      ],
    },
    page: 6,
    ...calculatePosition(0, 0, 'full'),
    customText: toCheckboxCustomText([0]),
  },
  {
    type: FieldType.CHECKBOX,
    fieldMeta: {
      direction: 'vertical',
      type: 'checkbox',
      values: [
        { id: 1, checked: false, value: 'Option 1' },
        { id: 2, checked: true, value: 'Option 2' },
        { id: 3, checked: false, value: 'Option 3' },
      ],
    },
    page: 6,
    ...calculatePosition(1, 0),
    customText: toCheckboxCustomText([1]),
  },
  {
    type: FieldType.CHECKBOX,
    fieldMeta: {
      direction: 'vertical',
      type: 'checkbox',
      required: true,
      values: [
        { id: 1, checked: false, value: 'Option 1' },
        { id: 2, checked: false, value: 'Option 2' },
      ],
    },
    page: 6,
    ...calculatePosition(2, 0),
    customText: toCheckboxCustomText([2]),
  },
  {
    type: FieldType.CHECKBOX,
    fieldMeta: {
      direction: 'vertical',
      type: 'checkbox',
      readOnly: true,
      values: [
        { id: 1, checked: false, value: 'Option 1' },
        { id: 2, checked: true, value: 'Option 2' },
      ],
    },
    page: 6,
    ...calculatePosition(2, 1),
    customText: '',
  },
  {
    type: FieldType.CHECKBOX,
    fieldMeta: {
      direction: 'vertical',
      type: 'checkbox',
      validationRule: CheckboxValidationRules.SELECT_AT_LEAST,
      validationLength: 2,
      values: [
        { id: 1, checked: false, value: 'Option 1' },
        { id: 2, checked: false, value: 'Option 2' },
        { id: 3, checked: false, value: 'Option 3' },
      ],
    },
    page: 6,
    ...calculatePosition(3, 0),
    customText: '',
  },
  {
    type: FieldType.CHECKBOX,
    fieldMeta: {
      direction: 'vertical',
      type: 'checkbox',
      validationRule: CheckboxValidationRules.SELECT_EXACTLY,
      validationLength: 2,
      values: [
        { id: 1, checked: false, value: 'Option 1' },
        { id: 2, checked: false, value: 'Option 2' },
        { id: 3, checked: false, value: 'Option 3' },
      ],
    },
    page: 6,
    ...calculatePosition(3, 1),
    customText: '',
  },
  {
    type: FieldType.CHECKBOX,
    fieldMeta: {
      direction: 'vertical',
      type: 'checkbox',
      validationRule: CheckboxValidationRules.SELECT_AT_MOST,
      validationLength: 2,
      values: [
        { id: 1, checked: false, value: 'Option 1' },
        { id: 2, checked: false, value: 'Option 2' },
        { id: 3, checked: false, value: 'Option 3' },
      ],
    },
    page: 6,
    ...calculatePosition(3, 2),
    customText: '',
  },

  /**
   * PAGE 7 DROPDOWN
   */
  {
    type: FieldType.DROPDOWN,
    fieldMeta: {
      values: [{ value: 'Option 1' }, { value: 'Option 2' }],
      type: 'dropdown',
    },
    page: 7,
    ...calculatePosition(0, 0, 'full'),
    customText: 'Option 1',
  },
  {
    type: FieldType.DROPDOWN,
    fieldMeta: {
      values: [{ value: 'Option 1' }, { value: 'Option 2' }],
      type: 'dropdown',
      defaultValue: 'Option 2',
    },
    page: 7,
    ...calculatePosition(1, 0),
    customText: 'Option 2',
  },
  {
    type: FieldType.DROPDOWN,
    fieldMeta: {
      values: [{ value: 'Option 1' }, { value: 'Option 2' }, { value: 'Option 3' }],
      type: 'dropdown',
      required: true,
    },
    page: 7,
    ...calculatePosition(2, 0),
    customText: 'Option 3',
  },
  {
    type: FieldType.DROPDOWN,
    fieldMeta: {
      values: [{ value: 'Option 1' }, { value: 'Option 2' }, { value: 'Option 3' }],
      type: 'dropdown',
      defaultValue: 'Option 1',
      readOnly: true,
    },
    page: 7,
    ...calculatePosition(2, 1),
    customText: 'Option 1',
  },
] as const;

export const formatFieldMetaTestFields = FIELD_META_TEST_FIELDS.map((field, index) => {
  return {
    ...field,
  };
});
