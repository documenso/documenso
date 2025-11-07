import { FieldType } from '@prisma/client';

import type { TFieldAndMeta } from '@documenso/lib/types/field-meta';
import { toCheckboxCustomText } from '@documenso/lib/utils/fields';

export type FieldTestData = TFieldAndMeta & {
  page: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  customText: string;
  signature?: string;
};

const columnWidth = 19.125;
const rowHeight = 6.7;

const alignmentGridStartX = 31;
const alignmentGridStartY = 19.02;

export const ALIGNMENT_TEST_FIELDS: FieldTestData[] = [
  /**
   * Row 1 EMAIL
   */
  {
    type: FieldType.EMAIL,
    fieldMeta: {
      fontSize: 10,
      textAlign: 'left',
      type: 'email',
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: 'admin@documenso.com',
  },
  {
    type: FieldType.EMAIL,
    fieldMeta: {
      textAlign: 'center',
      type: 'email',
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: 'admin@documenso.com',
  },
  {
    type: FieldType.EMAIL,
    fieldMeta: {
      fontSize: 20,
      textAlign: 'right',
      type: 'email',
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: 'admin@documenso.com',
  },
  /**
   * Row 2 NAME
   */
  {
    type: FieldType.NAME,
    fieldMeta: {
      fontSize: 10,
      textAlign: 'left',
      type: 'name',
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: 'John Doe',
  },
  {
    type: FieldType.NAME,
    fieldMeta: {
      textAlign: 'center',
      type: 'name',
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: 'John Doe',
  },
  {
    type: FieldType.NAME,
    fieldMeta: {
      fontSize: 20,
      textAlign: 'right',
      type: 'name',
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: 'John Doe',
  },
  /**
   * Row 3 DATE
   */
  {
    type: FieldType.DATE,
    fieldMeta: {
      fontSize: 10,
      textAlign: 'left',
      type: 'date',
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: '123456789',
  },
  {
    type: FieldType.DATE,
    fieldMeta: {
      textAlign: 'center',
      type: 'date',
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: '123456789',
  },
  {
    type: FieldType.DATE,
    fieldMeta: {
      fontSize: 20,
      textAlign: 'right',
      type: 'date',
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: '123456789',
  },
  /**
   * Row 4 TEXT
   */
  {
    type: FieldType.TEXT,
    fieldMeta: {
      fontSize: 10,
      textAlign: 'left',
      type: 'text',
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: '123456789',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: {
      textAlign: 'center',
      type: 'text',
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: '123456789',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: {
      fontSize: 20,
      textAlign: 'right',
      type: 'text',
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: '123456789',
  },
  /**
   * Row 5 NUMBER
   */
  {
    type: FieldType.NUMBER,
    fieldMeta: {
      fontSize: 10,
      textAlign: 'left',
      type: 'number',
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: '123456789',
  },
  {
    type: FieldType.NUMBER,
    fieldMeta: {
      textAlign: 'center',
      type: 'number',
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: '123456789',
  },
  {
    type: FieldType.NUMBER,
    fieldMeta: {
      fontSize: 20,
      textAlign: 'right',
      type: 'number',
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: '123456789',
  },
  /**
   * Row 6 Initials
   */
  {
    type: FieldType.INITIALS,
    fieldMeta: {
      fontSize: 10,
      textAlign: 'left',
      type: 'initials',
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: 'JD',
  },
  {
    type: FieldType.INITIALS,
    fieldMeta: {
      textAlign: 'center',
      type: 'initials',
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: 'JD',
  },
  {
    type: FieldType.INITIALS,
    fieldMeta: {
      fontSize: 20,
      textAlign: 'right',
      type: 'initials',
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: 'JD',
  },
  /**
   * Row 7 Radio
   */
  {
    type: FieldType.RADIO,
    fieldMeta: {
      fontSize: 10,
      direction: 'vertical',
      type: 'radio',
      values: [
        { id: 1, checked: true, value: 'Option 1' },
        { id: 2, checked: false, value: 'Option 2' },
      ],
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: '0',
  },
  {
    type: FieldType.RADIO,
    fieldMeta: {
      direction: 'vertical',
      type: 'radio',
      values: [
        { id: 1, checked: false, value: 'Option 1' },
        { id: 2, checked: true, value: 'Option 2' },
      ],
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: '2',
  },
  {
    type: FieldType.RADIO,
    fieldMeta: {
      fontSize: 20,
      direction: 'horizontal',
      type: 'radio',
      values: [
        { id: 1, checked: false, value: 'Option 1' },
        { id: 2, checked: false, value: 'Option 2' },
      ],
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: '',
  },
  /**
   * Row 8 Checkbox
   */
  {
    type: FieldType.CHECKBOX,
    fieldMeta: {
      fontSize: 10,
      direction: 'vertical',
      type: 'checkbox',
      values: [
        { id: 1, checked: true, value: 'Option 1' },
        { id: 2, checked: false, value: 'Option 2' },
      ],
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
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
      ],
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: toCheckboxCustomText([1]),
  },
  {
    type: FieldType.CHECKBOX,
    fieldMeta: {
      fontSize: 20,
      direction: 'horizontal',
      type: 'checkbox',
      values: [
        { id: 1, checked: false, value: 'Option 1' },
        { id: 2, checked: false, value: 'Option 2' },
      ],
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: '',
  },
  /**
   * Row 8 Dropdown
   */
  {
    type: FieldType.DROPDOWN,
    fieldMeta: {
      fontSize: 10,
      values: [{ value: 'Option 1' }, { value: 'Option 2' }],
      type: 'dropdown',
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: 'Option 1',
  },
  {
    type: FieldType.DROPDOWN,
    fieldMeta: {
      values: [{ value: 'Option 1' }, { value: 'Option 2' }],
      type: 'dropdown',
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: 'Option 1',
  },
  {
    type: FieldType.DROPDOWN,
    fieldMeta: {
      fontSize: 20,
      values: [{ value: 'Option 1' }, { value: 'Option 2' }, { value: 'Option 3' }],
      type: 'dropdown',
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: 'Option 1',
  },
  /**
   * Row 9 Signature
   */
  {
    type: FieldType.SIGNATURE,
    fieldMeta: {
      fontSize: 10,
      type: 'signature',
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: '',
    signature: 'My Signature',
  },
  {
    type: FieldType.SIGNATURE,
    fieldMeta: {
      type: 'signature',
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: '',
    signature: 'My Signature',
  },
  {
    type: FieldType.SIGNATURE,
    fieldMeta: {
      fontSize: 20,
      type: 'signature',
    },
    page: 1,
    height: rowHeight,
    width: columnWidth,
    positionX: 0,
    positionY: 0,
    customText: '',
    signature: 'My Signature',
  },
] as const;

export const formatAlignmentTestFields = ALIGNMENT_TEST_FIELDS.map((field, index) => {
  const row = Math.floor(index / 3);
  const column = index % 3;

  return {
    ...field,
    positionX: alignmentGridStartX + column * columnWidth,
    positionY: alignmentGridStartY + row * rowHeight,
  };
});
