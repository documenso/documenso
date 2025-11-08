import { FieldType } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

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

export const signatureBase64Demo = `data:image/png;base64,${fs.readFileSync(
  path.join(__dirname, '../../../packages/assets/', 'logo_icon.png'),
  'base64',
)}`;

const columnWidth = 19.125;
const fullColumnWidth = 57.37499999999998;
const rowHeight = 6.7;
const rowPadding = 0;

const calculatePositionPageOne = (
  row: number,
  column: number,
  width: 'full' | 'column' = 'column',
) => {
  const alignmentGridStartX = 31;
  const alignmentGridStartY = 19;

  return {
    height: rowHeight,
    width: width === 'full' ? fullColumnWidth : columnWidth,
    positionX: alignmentGridStartX + (column ?? 0) * columnWidth,
    positionY: alignmentGridStartY + row * (rowHeight + rowPadding),
  };
};

const calculatePositionPageTwo = (
  row: number,
  column: number,
  width: 'full' | 'column' = 'column',
) => {
  const alignmentGridStartX = 31;
  const alignmentGridStartY = 16.35;

  return {
    height: rowHeight,
    width: width === 'full' ? fullColumnWidth : columnWidth,
    positionX: alignmentGridStartX + (column ?? 0) * columnWidth,
    positionY: alignmentGridStartY + row * (rowHeight + rowPadding),
  };
};

const calculatePositionPageThree = (
  row: number,
  column: number,
  width: 'full' | 'column' = 'column',
  rowQuantity: number = 1,
) => {
  const alignmentGridStartX = 31;
  const alignmentGridStartY = 16.4;

  const rowHeight = 6.8;

  return {
    height: rowHeight * rowQuantity,
    width: width === 'full' ? fullColumnWidth : columnWidth,
    positionX: alignmentGridStartX + (column ?? 0) * columnWidth,
    positionY: alignmentGridStartY + row * (rowHeight + rowPadding),
  };
};

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
    ...calculatePositionPageOne(0, 0),
    customText: 'admin@documenso.com',
  },
  {
    type: FieldType.EMAIL,
    fieldMeta: {
      textAlign: 'center',
      type: 'email',
    },
    page: 1,
    ...calculatePositionPageOne(0, 1),
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
    ...calculatePositionPageOne(0, 2),
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
    ...calculatePositionPageOne(1, 0),
    customText: 'John Doe',
  },
  {
    type: FieldType.NAME,
    fieldMeta: {
      textAlign: 'center',
      type: 'name',
    },
    page: 1,
    ...calculatePositionPageOne(1, 1),
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
    ...calculatePositionPageOne(1, 2),
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
    ...calculatePositionPageOne(2, 0),
    customText: '123456789',
  },
  {
    type: FieldType.DATE,
    fieldMeta: {
      textAlign: 'center',
      type: 'date',
    },
    page: 1,
    ...calculatePositionPageOne(2, 1),
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
    ...calculatePositionPageOne(2, 2),
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
    ...calculatePositionPageOne(3, 0),
    customText: '123456789',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: {
      textAlign: 'center',
      type: 'text',
    },
    page: 1,
    ...calculatePositionPageOne(3, 1),
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
    ...calculatePositionPageOne(3, 2),
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
    ...calculatePositionPageOne(4, 0),
    customText: '123456789',
  },
  {
    type: FieldType.NUMBER,
    fieldMeta: {
      textAlign: 'center',
      type: 'number',
    },
    page: 1,
    ...calculatePositionPageOne(4, 1),
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
    ...calculatePositionPageOne(4, 2),
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
    ...calculatePositionPageOne(5, 0),
    customText: 'JD',
  },
  {
    type: FieldType.INITIALS,
    fieldMeta: {
      textAlign: 'center',
      type: 'initials',
    },
    page: 1,
    ...calculatePositionPageOne(5, 1),
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
    ...calculatePositionPageOne(5, 2),
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
    ...calculatePositionPageOne(6, 0),
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
      ],
    },
    page: 1,
    ...calculatePositionPageOne(6, 1),
    customText: '',
  },
  {
    type: FieldType.RADIO,
    fieldMeta: {
      fontSize: 20,
      direction: 'horizontal',
      type: 'radio',
      values: [
        { id: 1, checked: false, value: 'Option 1' },
        { id: 2, checked: true, value: 'Option 2' },
      ],
    },
    page: 1,
    ...calculatePositionPageOne(6, 2),
    customText: '1',
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
    ...calculatePositionPageOne(7, 0),
    customText: toCheckboxCustomText([0]),
  },
  {
    type: FieldType.CHECKBOX,
    fieldMeta: {
      direction: 'vertical',
      type: 'checkbox',
      values: [
        { id: 1, checked: false, value: 'Option 1' },
        { id: 2, checked: false, value: 'Option 2' },
      ],
    },
    page: 1,
    ...calculatePositionPageOne(7, 1),
    customText: '',
  },
  {
    type: FieldType.CHECKBOX,
    fieldMeta: {
      fontSize: 20,
      direction: 'horizontal',
      type: 'checkbox',
      values: [
        { id: 1, checked: false, value: 'Option 1' },
        { id: 2, checked: true, value: 'Option 2' },
      ],
    },
    page: 1,
    ...calculatePositionPageOne(7, 2),
    customText: toCheckboxCustomText([1]),
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
    ...calculatePositionPageOne(8, 0),
    customText: 'Option 1',
  },
  {
    type: FieldType.DROPDOWN,
    fieldMeta: {
      values: [{ value: 'Option 1' }, { value: 'Option 2' }],
      type: 'dropdown',
    },
    page: 1,
    ...calculatePositionPageOne(8, 1),
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
    ...calculatePositionPageOne(8, 2),
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
    ...calculatePositionPageOne(9, 0),
    customText: '',
    signature: 'My Signature',
  },
  {
    type: FieldType.SIGNATURE,
    fieldMeta: {
      type: 'signature',
    },
    page: 1,
    ...calculatePositionPageOne(9, 1),
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
    ...calculatePositionPageOne(9, 2),
    customText: '',
    signature: 'My Signature',
  },
  /**
   * @@@@@@@@@@@@@@@@@@@@@@@
   *
   * PAGE 2
   *
   * @@@@@@@@@@@@@@@@@@@@@@@
   */
  // TEXT GRID ROW 1
  {
    type: FieldType.TEXT,
    fieldMeta: {
      textAlign: 'left',
      type: 'text',
      verticalAlign: 'top',
    },
    page: 2,
    ...calculatePositionPageTwo(0, 0),
    customText: 'SOME TEXT',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: {
      textAlign: 'center',
      type: 'text',
      verticalAlign: 'top',
    },
    page: 2,
    ...calculatePositionPageTwo(0, 1),
    customText: 'SOME TEXT',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: {
      textAlign: 'right',
      type: 'text',
      verticalAlign: 'top',
    },
    page: 2,
    ...calculatePositionPageTwo(0, 2),
    customText: 'SOME TEXT',
  },
  // TEXT GRID ROW 2
  {
    type: FieldType.TEXT,
    fieldMeta: {
      textAlign: 'left',
      type: 'text',
      verticalAlign: 'middle',
    },
    page: 2,
    ...calculatePositionPageTwo(1, 0),
    customText: 'SOME TEXT',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: {
      textAlign: 'center',
      type: 'text',
      verticalAlign: 'middle',
    },
    page: 2,
    ...calculatePositionPageTwo(1, 1),
    customText: 'SOME TEXT',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: {
      textAlign: 'right',
      type: 'text',
      verticalAlign: 'middle',
    },
    page: 2,
    ...calculatePositionPageTwo(1, 2),
    customText: 'SOME TEXT',
  },
  // TEXT GRID ROW 3
  {
    type: FieldType.TEXT,
    fieldMeta: {
      textAlign: 'left',
      type: 'text',
      verticalAlign: 'bottom',
    },
    page: 2,
    ...calculatePositionPageTwo(2, 0),
    customText: 'SOME TEXT',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: {
      textAlign: 'center',
      type: 'text',
      verticalAlign: 'bottom',
    },
    page: 2,
    ...calculatePositionPageTwo(2, 1),
    customText: 'SOME TEXT',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: {
      textAlign: 'right',
      type: 'text',
      verticalAlign: 'bottom',
    },
    page: 2,
    ...calculatePositionPageTwo(2, 2),
    customText: 'SOME TEXT',
  },
  // NUMBER GRID ROW 1
  {
    type: FieldType.NUMBER,
    fieldMeta: {
      textAlign: 'left',
      type: 'number',
      verticalAlign: 'top',
    },
    page: 2,
    ...calculatePositionPageTwo(3, 0),
    customText: '123456789123456789',
  },
  {
    type: FieldType.NUMBER,
    fieldMeta: {
      textAlign: 'center',
      type: 'number',
      verticalAlign: 'top',
    },
    page: 2,
    ...calculatePositionPageTwo(3, 1),
    customText: '123456789123456789',
  },
  {
    type: FieldType.NUMBER,
    fieldMeta: {
      textAlign: 'right',
      type: 'number',
      verticalAlign: 'top',
    },
    page: 2,
    ...calculatePositionPageTwo(3, 2),
    customText: '123456789123456789',
  },
  // NUMBER GRID ROW 2
  {
    type: FieldType.NUMBER,
    fieldMeta: {
      textAlign: 'left',
      type: 'number',
      verticalAlign: 'middle',
    },
    page: 2,
    ...calculatePositionPageTwo(4, 0),
    customText: '123456789123456789',
  },
  {
    type: FieldType.NUMBER,
    fieldMeta: {
      textAlign: 'center',
      type: 'number',
      verticalAlign: 'middle',
    },
    page: 2,
    ...calculatePositionPageTwo(4, 1),
    customText: '123456789123456789',
  },
  {
    type: FieldType.NUMBER,
    fieldMeta: {
      textAlign: 'right',
      type: 'number',
      verticalAlign: 'middle',
    },
    page: 2,
    ...calculatePositionPageTwo(4, 2),
    customText: '123456789123456789',
  },
  // NUMBER GRID ROW 3
  {
    type: FieldType.NUMBER,
    fieldMeta: {
      textAlign: 'left',
      type: 'number',
      verticalAlign: 'bottom',
    },
    page: 2,
    ...calculatePositionPageTwo(5, 0),
    customText: '123456789123456789',
  },
  {
    type: FieldType.NUMBER,
    fieldMeta: {
      textAlign: 'center',
      type: 'number',
      verticalAlign: 'bottom',
    },
    page: 2,
    ...calculatePositionPageTwo(5, 1),
    customText: '123456789123456789',
  },
  {
    type: FieldType.NUMBER,
    fieldMeta: {
      textAlign: 'right',
      type: 'number',
      verticalAlign: 'bottom',
    },
    page: 2,
    ...calculatePositionPageTwo(5, 2),
    customText: '123456789123456789',
  },
  // Text combing
  {
    type: FieldType.TEXT,
    fieldMeta: {
      type: 'text',
      verticalAlign: 'middle',
      letterSpacing: 32,
      characterLimit: 9,
    },
    page: 2,
    ...calculatePositionPageTwo(6, 0, 'full'),
    positionX: calculatePositionPageTwo(6, 0, 'full').positionX + 1.75,
    width: calculatePositionPageTwo(6, 0, 'full').width + 1.75,
    customText: 'HEY HEY 1',
  },
  // Number combing
  {
    type: FieldType.NUMBER,
    fieldMeta: {
      type: 'number',
      verticalAlign: 'middle',
      letterSpacing: 32,
    },
    page: 2,
    ...calculatePositionPageTwo(7, 0, 'full'),
    positionX: calculatePositionPageTwo(7, 0, 'full').positionX + 1.75,
    width: calculatePositionPageTwo(7, 0, 'full').width + 1.75,

    customText: '123456789',
  },
  /**
   * @@@@@@@@@@@@@@@@@@@@@@@
   *
   * PAGE 2 TEXT MULTILINE
   *
   * @@@@@@@@@@@@@@@@@@@@@@@
   */
  {
    type: FieldType.TEXT,
    fieldMeta: {
      verticalAlign: 'top',
      textAlign: 'left',
      lineHeight: 2.24,
      type: 'text',
    },
    page: 3,
    ...calculatePositionPageThree(0, 0, 'full', 3),
    customText:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: {
      verticalAlign: 'middle',
      textAlign: 'center',
      lineHeight: 2.24,
      type: 'text',
    },
    page: 3,
    ...calculatePositionPageThree(3, 0, 'full', 3),
    customText:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: {
      verticalAlign: 'bottom',
      textAlign: 'right',
      lineHeight: 2.24,
      type: 'text',
    },
    page: 3,
    ...calculatePositionPageThree(6, 0, 'full', 3),
    customText:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  },
] as const;
