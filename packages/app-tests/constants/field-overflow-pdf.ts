import { FieldType } from '@prisma/client';

import type { FieldTestData } from './field-alignment-pdf';

/**
 * Overflow test data extends FieldTestData with a `seedFieldMeta` property.
 *
 * - `fieldMeta`: Minimal field meta sent via the API. Omit properties that the API
 *   auto-applies via ZEnvelopeFieldAndMetaSchema defaults (e.g. `overflow: 'auto'` for
 *   date/email/signature fields). This tests that the API correctly sets defaults.
 *
 * - `seedFieldMeta`: Full field meta written directly to the DB by the seed function.
 *   Must include ALL properties explicitly since the seed bypasses API validation/defaults.
 *   Used by `seedOverflowTestDocument` in initial-seed.ts.
 */
export type OverflowFieldTestData = Omit<FieldTestData, 'fieldMeta'> & {
  fieldMeta?: FieldTestData['fieldMeta'];
  seedFieldMeta: FieldTestData['fieldMeta'];
};

const SINGLE_LINE_HEIGHT = 1.75;
const MULTI_LINE_HEIGHT = 12;
const DEFAULT_BOX_WIDTH = 25;
const SINGLE_TYPE_BOX_WIDTH = 35;
const DEFAULT_START_X = 10;

/**
 * Pages 1-3: Date, Email, Signature
 * Single-line section (rows 0-2): single column, full width
 * Pages 1-2 multi-line: 3×3 grid (rows = TA_LEFT/CENTER/RIGHT, columns = short/medium/long text)
 * Page 3 multi-line: stacked single column (signature has no text align control)
 */
const SINGLE_TYPE_ML_COLUMN_X = [2.5, 35, 67.5];
const SINGLE_TYPE_ML_BOX_WIDTH = 30;
const SINGLE_TYPE_ML_ROW_Y = [45, 63, 83];

const calculateSingleLinePosition = (row: number) => {
  const singleLineYPositions = [15, 23, 31];

  return {
    positionX: DEFAULT_START_X,
    positionY: singleLineYPositions[row],
    width: SINGLE_TYPE_BOX_WIDTH,
    height: SINGLE_LINE_HEIGHT,
  };
};

/** Pages 1-2: multi-line 3×3 grid */
const calculateMultiLinePosition = (row: number, column: number) => {
  return {
    positionX: SINGLE_TYPE_ML_COLUMN_X[column],
    positionY: SINGLE_TYPE_ML_ROW_Y[row],
    width: SINGLE_TYPE_ML_BOX_WIDTH,
    height: MULTI_LINE_HEIGHT,
  };
};

/** Page 3: multi-line stacked single column */
const calculateStackedMultiLinePosition = (row: number) => {
  const yPositions = [45, 63, 81];

  return {
    positionX: DEFAULT_START_X,
    positionY: yPositions[row],
    width: SINGLE_TYPE_BOX_WIDTH,
    height: MULTI_LINE_HEIGHT,
  };
};

/**
 * Pages 4-5: Text Auto Mode (3x3 grid)
 */
const TEXT_AUTO_COLUMN_X = [5, 35.5, 66];
const TEXT_AUTO_BOX_WIDTH = 28;

const calculateTextAutoPosition = (row: number, column: number, isSingleLine: boolean) => {
  if (isSingleLine) {
    // Single-line: all 9 items evenly spaced down the page.
    // Order: row0-col0, row0-col1, row0-col2, row1-col0, ...
    const startY = 10;
    const endY = 92;
    const spacing = (endY - startY) / 8; // 9 items, 8 gaps = 10.25%
    const itemIndex = row * 3 + column;

    return {
      positionX: TEXT_AUTO_COLUMN_X[column],
      positionY: startY + itemIndex * spacing,
      width: TEXT_AUTO_BOX_WIDTH,
      height: SINGLE_LINE_HEIGHT,
    };
  }

  // Multi-line: 3 rows evenly spaced, bottom row near page bottom.
  // Box is 12% tall. Top of last box at 80% so bottom edge is at 92%.
  const multiLineYPositions = [10, 45, 80];

  return {
    positionX: TEXT_AUTO_COLUMN_X[column],
    positionY: multiLineYPositions[row],
    width: TEXT_AUTO_BOX_WIDTH,
    height: MULTI_LINE_HEIGHT,
  };
};

/**
 * Page 6: Explicit Modes
 */
const HORIZONTAL_CENTERED_X = (100 - DEFAULT_BOX_WIDTH) / 2; // 37.5%

const calculateExplicitHorizontalPosition = (row: number) => {
  const yPositions = [15, 21, 27];

  return {
    positionX: HORIZONTAL_CENTERED_X,
    positionY: yPositions[row],
    width: DEFAULT_BOX_WIDTH,
    height: SINGLE_LINE_HEIGHT,
  };
};

const calculateExplicitVerticalPosition = (column: number) => {
  const xPositions = [5, 37.5, 70];

  return {
    positionX: xPositions[column],
    positionY: 43,
    width: DEFAULT_BOX_WIDTH,
    height: MULTI_LINE_HEIGHT,
  };
};

export const OVERFLOW_TEST_FIELDS: OverflowFieldTestData[] = [
  /**
   * @@@@@@@@@@@@@@@@@@@@@@@
   *
   * PAGE 1: DATE OVERFLOW
   *
   * @@@@@@@@@@@@@@@@@@@@@@@
   */
  // Single-line: Row 0-2 (default date meta — API auto-adds overflow: 'auto')
  {
    type: FieldType.DATE,
    fieldMeta: undefined,
    seedFieldMeta: { type: 'date', overflow: 'auto' },
    page: 1,
    ...calculateSingleLinePosition(0),
    customText: 'Apr 16 2026',
  },
  {
    type: FieldType.DATE,
    fieldMeta: undefined,
    seedFieldMeta: { type: 'date', overflow: 'auto' },
    page: 1,
    ...calculateSingleLinePosition(1),
    customText: 'Wednesday, April 16, 2026 at 14:30:45 UTC',
  },
  {
    type: FieldType.DATE,
    fieldMeta: undefined,
    seedFieldMeta: { type: 'date', overflow: 'auto' },
    page: 1,
    ...calculateSingleLinePosition(2),
    customText:
      'Wednesday, April 16, 2026 at 14:30:45.123 Coordinated Universal Time signed in Melbourne, Australia',
  },
  // Multi-line 3×3: Row 0 = TA_LEFT (short / medium / long)
  {
    type: FieldType.DATE,
    fieldMeta: { type: 'date', textAlign: 'left' },
    seedFieldMeta: { type: 'date', overflow: 'auto', textAlign: 'left' },
    page: 1,
    ...calculateMultiLinePosition(0, 0),
    customText: 'Apr 16 2026',
  },
  {
    type: FieldType.DATE,
    fieldMeta: { type: 'date', textAlign: 'left' },
    seedFieldMeta: { type: 'date', overflow: 'auto', textAlign: 'left' },
    page: 1,
    ...calculateMultiLinePosition(0, 1),
    customText: 'Wednesday, April 16, 2026 at 14:30:45 Coordinated Universal Time',
  },
  {
    type: FieldType.DATE,
    fieldMeta: { type: 'date', textAlign: 'left' },
    seedFieldMeta: { type: 'date', overflow: 'auto', textAlign: 'left' },
    page: 1,
    ...calculateMultiLinePosition(0, 2),
    customText:
      'Wednesday, April 16, 2026 at 14:30:45.123 Coordinated Universal Time signed in Melbourne, Australia. Count to 20, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty',
  },
  // Multi-line 3×3: Row 1 = TA_CENTER (short / medium / long)
  {
    type: FieldType.DATE,
    fieldMeta: { type: 'date', textAlign: 'center' },
    seedFieldMeta: { type: 'date', overflow: 'auto', textAlign: 'center' },
    page: 1,
    ...calculateMultiLinePosition(1, 0),
    customText: 'Apr 16 2026',
  },
  {
    type: FieldType.DATE,
    fieldMeta: { type: 'date', textAlign: 'center' },
    seedFieldMeta: { type: 'date', overflow: 'auto', textAlign: 'center' },
    page: 1,
    ...calculateMultiLinePosition(1, 1),
    customText: 'Wednesday, April 16, 2026 at 14:30:45 Coordinated Universal Time',
  },
  {
    type: FieldType.DATE,
    fieldMeta: { type: 'date', textAlign: 'center' },
    seedFieldMeta: { type: 'date', overflow: 'auto', textAlign: 'center' },
    page: 1,
    ...calculateMultiLinePosition(1, 2),
    customText:
      'Wednesday, April 16, 2026 at 14:30:45.123 Coordinated Universal Time signed in Melbourne, Australia. Count to 20, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty',
  },
  // Multi-line 3×3: Row 2 = TA_RIGHT (short / medium / long)
  {
    type: FieldType.DATE,
    fieldMeta: { type: 'date', textAlign: 'right' },
    seedFieldMeta: { type: 'date', overflow: 'auto', textAlign: 'right' },
    page: 1,
    ...calculateMultiLinePosition(2, 0),
    customText: 'Apr 16 2026',
  },
  {
    type: FieldType.DATE,
    fieldMeta: { type: 'date', textAlign: 'right' },
    seedFieldMeta: { type: 'date', overflow: 'auto', textAlign: 'right' },
    page: 1,
    ...calculateMultiLinePosition(2, 1),
    customText: 'Wednesday, April 16, 2026 at 14:30:45 Coordinated Universal Time',
  },
  {
    type: FieldType.DATE,
    fieldMeta: { type: 'date', textAlign: 'right' },
    seedFieldMeta: { type: 'date', overflow: 'auto', textAlign: 'right' },
    page: 1,
    ...calculateMultiLinePosition(2, 2),
    customText:
      'Wednesday, April 16, 2026 at 14:30:45.123 Coordinated Universal Time signed in Melbourne, Australia. Count to 20, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty',
  },

  /**
   * @@@@@@@@@@@@@@@@@@@@@@@
   *
   * PAGE 2: EMAIL OVERFLOW
   *
   * @@@@@@@@@@@@@@@@@@@@@@@
   */
  // Single-line: Row 0-2 (default email meta — API auto-adds overflow: 'auto')
  {
    type: FieldType.EMAIL,
    fieldMeta: undefined,
    seedFieldMeta: { type: 'email', overflow: 'auto' },
    page: 2,
    ...calculateSingleLinePosition(0),
    customText: 'example@documenso.com',
  },
  {
    type: FieldType.EMAIL,
    fieldMeta: undefined,
    seedFieldMeta: { type: 'email', overflow: 'auto' },
    page: 2,
    ...calculateSingleLinePosition(1),
    customText: 'example+medium-overflow-test@documenso.com',
  },
  {
    type: FieldType.EMAIL,
    fieldMeta: undefined,
    seedFieldMeta: { type: 'email', overflow: 'auto' },
    page: 2,
    ...calculateSingleLinePosition(2),
    customText:
      'example+maximum-overflow-testing-across-the-page-width-to-verify-text-extends-beyond-field@documenso.com',
  },
  // Multi-line 3×3: Row 0 = TA_LEFT (short / medium / long)
  {
    type: FieldType.EMAIL,
    fieldMeta: { type: 'email', textAlign: 'left' },
    seedFieldMeta: { type: 'email', overflow: 'auto', textAlign: 'left' },
    page: 2,
    ...calculateMultiLinePosition(0, 0),
    customText: 'example@documenso.com',
  },
  {
    type: FieldType.EMAIL,
    fieldMeta: { type: 'email', textAlign: 'left' },
    seedFieldMeta: { type: 'email', overflow: 'auto', textAlign: 'left' },
    page: 2,
    ...calculateMultiLinePosition(0, 1),
    customText: 'example+medium-wrapped-text@documenso.com',
  },
  {
    type: FieldType.EMAIL,
    fieldMeta: { type: 'email', textAlign: 'left' },
    seedFieldMeta: { type: 'email', overflow: 'auto', textAlign: 'left' },
    page: 2,
    ...calculateMultiLinePosition(0, 2),
    customText:
      'example+this-is-an-extremely-long-email-address-that-is-designed-to-overflow-vertically-out-of-the-field-box-and-extend-well-beyond-the-bottom-of-the-page-to-verify-that-the-vertical-overflow-logic-correctly-handles-text-that-wraps@documenso.com',
  },
  // Multi-line 3×3: Row 1 = TA_CENTER (short / medium / long)
  {
    type: FieldType.EMAIL,
    fieldMeta: { type: 'email', textAlign: 'center' },
    seedFieldMeta: { type: 'email', overflow: 'auto', textAlign: 'center' },
    page: 2,
    ...calculateMultiLinePosition(1, 0),
    customText: 'example@documenso.com',
  },
  {
    type: FieldType.EMAIL,
    fieldMeta: { type: 'email', textAlign: 'center' },
    seedFieldMeta: { type: 'email', overflow: 'auto', textAlign: 'center' },
    page: 2,
    ...calculateMultiLinePosition(1, 1),
    customText: 'example+medium-wrapped-text@documenso.com',
  },
  {
    type: FieldType.EMAIL,
    fieldMeta: { type: 'email', textAlign: 'center' },
    seedFieldMeta: { type: 'email', overflow: 'auto', textAlign: 'center' },
    page: 2,
    ...calculateMultiLinePosition(1, 2),
    customText:
      'example+this-is-an-extremely-long-email-address-that-is-designed-to-overflow-vertically-out-of-the-field-box-and-extend-well-beyond-the-bottom-of-the-page-to-verify-that-the-vertical-overflow-logic-correctly-handles-text-that-wraps@documenso.com',
  },
  // Multi-line 3×3: Row 2 = TA_RIGHT (short / medium / long)
  {
    type: FieldType.EMAIL,
    fieldMeta: { type: 'email', textAlign: 'right' },
    seedFieldMeta: { type: 'email', overflow: 'auto', textAlign: 'right' },
    page: 2,
    ...calculateMultiLinePosition(2, 0),
    customText: 'example@documenso.com',
  },
  {
    type: FieldType.EMAIL,
    fieldMeta: { type: 'email', textAlign: 'right' },
    seedFieldMeta: { type: 'email', overflow: 'auto', textAlign: 'right' },
    page: 2,
    ...calculateMultiLinePosition(2, 1),
    customText: 'example+medium-wrapped-text@documenso.com',
  },
  {
    type: FieldType.EMAIL,
    fieldMeta: { type: 'email', textAlign: 'right' },
    seedFieldMeta: { type: 'email', overflow: 'auto', textAlign: 'right' },
    page: 2,
    ...calculateMultiLinePosition(2, 2),
    customText:
      'example+this-is-an-extremely-long-email-address-that-is-designed-to-overflow-vertically-out-of-the-field-box-and-extend-well-beyond-the-bottom-of-the-page-to-verify-that-the-vertical-overflow-logic-correctly-handles-text-that-wraps@documenso.com',
  },

  /**
   * @@@@@@@@@@@@@@@@@@@@@@@
   *
   * PAGE 3: SIGNATURE OVERFLOW
   *
   * @@@@@@@@@@@@@@@@@@@@@@@
   */
  // Single-line: Row 0-2 (default signature meta — API auto-adds overflow: 'auto')
  {
    type: FieldType.SIGNATURE,
    fieldMeta: undefined,
    seedFieldMeta: { type: 'signature', overflow: 'auto' },
    page: 3,
    ...calculateSingleLinePosition(0),
    customText: '',
    signature: 'John Doe',
  },
  {
    type: FieldType.SIGNATURE,
    fieldMeta: undefined,
    seedFieldMeta: { type: 'signature', overflow: 'auto' },
    page: 3,
    ...calculateSingleLinePosition(1),
    customText: '',
    signature: 'My Signature should overflow the field width',
  },
  {
    type: FieldType.SIGNATURE,
    fieldMeta: undefined,
    seedFieldMeta: { type: 'signature', overflow: 'auto' },
    page: 3,
    ...calculateSingleLinePosition(2),
    customText: '',
    signature:
      'My Signature should overflow the full signature field width and continue across the page to verify text is no longer clipped by the box boundary',
  },
  // Multi-line stacked: short / medium / long
  {
    type: FieldType.SIGNATURE,
    fieldMeta: undefined,
    seedFieldMeta: { type: 'signature', overflow: 'auto' },
    page: 3,
    ...calculateStackedMultiLinePosition(0),
    customText: '',
    signature: 'John Doe',
  },
  {
    type: FieldType.SIGNATURE,
    fieldMeta: undefined,
    seedFieldMeta: { type: 'signature', overflow: 'auto' },
    page: 3,
    ...calculateStackedMultiLinePosition(1),
    customText: '',
    signature: 'My Signature wraps within the tall field',
  },
  {
    type: FieldType.SIGNATURE,
    fieldMeta: undefined,
    seedFieldMeta: { type: 'signature', overflow: 'auto' },
    page: 3,
    ...calculateStackedMultiLinePosition(2),
    customText: '',
    signature:
      'Count to 40, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty one twenty two twenty three twenty four twenty five twenty six twenty seven twenty eight twenty nine thirty thirty one thirty two thirty three thirty four thirty five thirty six thirty seven thirty eight thirty nine forty',
  },

  /**
   * @@@@@@@@@@@@@@@@@@@@@@@
   *
   * PAGE 4: TEXT AUTO - SINGLE-LINE (3x3 grid)
   *
   * @@@@@@@@@@@@@@@@@@@@@@@
   */
  // Row 0 (top)
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'left', verticalAlign: 'top' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'left', verticalAlign: 'top' },
    page: 4,
    ...calculateTextAutoPosition(0, 0, true),
    customText: 'This text should overflow horizontally',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'center', verticalAlign: 'top' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'center', verticalAlign: 'top' },
    page: 4,
    ...calculateTextAutoPosition(0, 1, true),
    customText: 'This text should overflow horizontally',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'right', verticalAlign: 'top' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'right', verticalAlign: 'top' },
    page: 4,
    ...calculateTextAutoPosition(0, 2, true),
    customText: 'This text should overflow horizontally',
  },
  // Row 1 (middle)
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'left', verticalAlign: 'middle' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'left', verticalAlign: 'middle' },
    page: 4,
    ...calculateTextAutoPosition(1, 0, true),
    customText: 'This text should overflow horizontally',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'center', verticalAlign: 'middle' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'center', verticalAlign: 'middle' },
    page: 4,
    ...calculateTextAutoPosition(1, 1, true),
    customText: 'This text should overflow horizontally',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'right', verticalAlign: 'middle' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'right', verticalAlign: 'middle' },
    page: 4,
    ...calculateTextAutoPosition(1, 2, true),
    customText: 'This text should overflow horizontally',
  },
  // Row 2 (bottom)
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'left', verticalAlign: 'bottom' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'left', verticalAlign: 'bottom' },
    page: 4,
    ...calculateTextAutoPosition(2, 0, true),
    customText: 'This text should overflow horizontally',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'center', verticalAlign: 'bottom' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'center', verticalAlign: 'bottom' },
    page: 4,
    ...calculateTextAutoPosition(2, 1, true),
    customText: 'This text should overflow horizontally',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'right', verticalAlign: 'bottom' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'right', verticalAlign: 'bottom' },
    page: 4,
    ...calculateTextAutoPosition(2, 2, true),
    customText: 'This text should overflow horizontally',
  },

  /**
   * @@@@@@@@@@@@@@@@@@@@@@@
   *
   * PAGE 5: TEXT AUTO - MULTI-LINE (3x3 grid)
   *
   * @@@@@@@@@@@@@@@@@@@@@@@
   */
  // Row 0 (top)
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'left', verticalAlign: 'top' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'left', verticalAlign: 'top' },
    page: 5,
    ...calculateTextAutoPosition(0, 0, false),
    customText:
      'Count to 20, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'center', verticalAlign: 'top' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'center', verticalAlign: 'top' },
    page: 5,
    ...calculateTextAutoPosition(0, 1, false),
    customText:
      'Count to 20, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'right', verticalAlign: 'top' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'right', verticalAlign: 'top' },
    page: 5,
    ...calculateTextAutoPosition(0, 2, false),
    customText:
      'Count to 20, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty',
  },
  // Row 1 (middle)
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'left', verticalAlign: 'middle' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'left', verticalAlign: 'middle' },
    page: 5,
    ...calculateTextAutoPosition(1, 0, false),
    customText:
      'Count to 20, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'center', verticalAlign: 'middle' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'center', verticalAlign: 'middle' },
    page: 5,
    ...calculateTextAutoPosition(1, 1, false),
    customText:
      'Count to 20, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'right', verticalAlign: 'middle' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'right', verticalAlign: 'middle' },
    page: 5,
    ...calculateTextAutoPosition(1, 2, false),
    customText:
      'Count to 20, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty',
  },
  // Row 2 (bottom)
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'left', verticalAlign: 'bottom' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'left', verticalAlign: 'bottom' },
    page: 5,
    ...calculateTextAutoPosition(2, 0, false),
    customText:
      'Count to 20, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'center', verticalAlign: 'bottom' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'center', verticalAlign: 'bottom' },
    page: 5,
    ...calculateTextAutoPosition(2, 1, false),
    customText:
      'Count to 20, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'right', verticalAlign: 'bottom' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'right', verticalAlign: 'bottom' },
    page: 5,
    ...calculateTextAutoPosition(2, 2, false),
    customText:
      'Count to 20, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty',
  },

  /**
   * @@@@@@@@@@@@@@@@@@@@@@@
   *
   * PAGE 6: TEXT AUTO - MULTI-LINE HEIGHT OVERFLOW
   *
   * @@@@@@@@@@@@@@@@@@@@@@@
   */
  // Same 3×3 grid as page 5 but with longer text that overflows vertically.
  // left / top
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'left', verticalAlign: 'top' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'left', verticalAlign: 'top' },
    page: 6,
    ...calculateTextAutoPosition(0, 0, false),
    customText:
      'Count to 40, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty one twenty two twenty three twenty four twenty five twenty six twenty seven twenty eight twenty nine thirty thirty one thirty two thirty three thirty four thirty five thirty six thirty seven thirty eight thirty nine forty',
  },
  // center / top
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'center', verticalAlign: 'top' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'center', verticalAlign: 'top' },
    page: 6,
    ...calculateTextAutoPosition(0, 1, false),
    customText:
      'Count to 40, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty one twenty two twenty three twenty four twenty five twenty six twenty seven twenty eight twenty nine thirty thirty one thirty two thirty three thirty four thirty five thirty six thirty seven thirty eight thirty nine forty',
  },
  // right / top
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'right', verticalAlign: 'top' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'right', verticalAlign: 'top' },
    page: 6,
    ...calculateTextAutoPosition(0, 2, false),
    customText:
      'Count to 40, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty one twenty two twenty three twenty four twenty five twenty six twenty seven twenty eight twenty nine thirty thirty one thirty two thirty three thirty four thirty five thirty six thirty seven thirty eight thirty nine forty',
  },
  // left / middle
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'left', verticalAlign: 'middle' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'left', verticalAlign: 'middle' },
    page: 6,
    ...calculateTextAutoPosition(1, 0, false),
    customText:
      'Count to 40, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty one twenty two twenty three twenty four twenty five twenty six twenty seven twenty eight twenty nine thirty thirty one thirty two thirty three thirty four thirty five thirty six thirty seven thirty eight thirty nine forty',
  },
  // center / middle
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'center', verticalAlign: 'middle' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'center', verticalAlign: 'middle' },
    page: 6,
    ...calculateTextAutoPosition(1, 1, false),
    customText:
      'Count to 40, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty one twenty two twenty three twenty four twenty five twenty six twenty seven twenty eight twenty nine thirty thirty one thirty two thirty three thirty four thirty five thirty six thirty seven thirty eight thirty nine forty',
  },
  // right / middle
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'right', verticalAlign: 'middle' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'right', verticalAlign: 'middle' },
    page: 6,
    ...calculateTextAutoPosition(1, 2, false),
    customText:
      'Count to 40, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty one twenty two twenty three twenty four twenty five twenty six twenty seven twenty eight twenty nine thirty thirty one thirty two thirty three thirty four thirty five thirty six thirty seven thirty eight thirty nine forty',
  },
  // left / bottom
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'left', verticalAlign: 'bottom' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'left', verticalAlign: 'bottom' },
    page: 6,
    ...calculateTextAutoPosition(2, 0, false),
    customText:
      'Count to 40, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty one twenty two twenty three twenty four twenty five twenty six twenty seven twenty eight twenty nine thirty thirty one thirty two thirty three thirty four thirty five thirty six thirty seven thirty eight thirty nine forty',
  },
  // center / bottom
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'center', verticalAlign: 'bottom' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'center', verticalAlign: 'bottom' },
    page: 6,
    ...calculateTextAutoPosition(2, 1, false),
    customText:
      'Count to 40, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty one twenty two twenty three twenty four twenty five twenty six twenty seven twenty eight twenty nine thirty thirty one thirty two thirty three thirty four thirty five thirty six thirty seven thirty eight thirty nine forty',
  },
  // right / bottom
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'auto', textAlign: 'right', verticalAlign: 'bottom' },
    seedFieldMeta: { type: 'text', overflow: 'auto', textAlign: 'right', verticalAlign: 'bottom' },
    page: 6,
    ...calculateTextAutoPosition(2, 2, false),
    customText:
      'Count to 40, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty one twenty two twenty three twenty four twenty five twenty six twenty seven twenty eight twenty nine thirty thirty one thirty two thirty three thirty four thirty five thirty six thirty seven thirty eight thirty nine forty',
  },

  /**
   * @@@@@@@@@@@@@@@@@@@@@@@
   *
   * PAGE 7: EXPLICIT MODES
   *
   * @@@@@@@@@@@@@@@@@@@@@@@
   */
  // Section A: Horizontal mode (3 boxes in a row)
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'horizontal', textAlign: 'left' },
    seedFieldMeta: { type: 'text', overflow: 'horizontal', textAlign: 'left' },
    page: 7,
    ...calculateExplicitHorizontalPosition(0),
    customText: 'Explicit horizontal overflow text that should extend beyond the field',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'horizontal', textAlign: 'center' },
    seedFieldMeta: { type: 'text', overflow: 'horizontal', textAlign: 'center' },
    page: 7,
    ...calculateExplicitHorizontalPosition(1),
    customText: 'Explicit horizontal overflow text that should extend beyond the field',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'horizontal', textAlign: 'right' },
    seedFieldMeta: { type: 'text', overflow: 'horizontal', textAlign: 'right' },
    page: 7,
    ...calculateExplicitHorizontalPosition(2),
    customText: 'Explicit horizontal overflow text that should extend beyond the field',
  },
  // Section B: Vertical mode (3 boxes in a column)
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'vertical', verticalAlign: 'top' },
    seedFieldMeta: { type: 'text', overflow: 'vertical', verticalAlign: 'top' },
    page: 7,
    ...calculateExplicitVerticalPosition(0),
    customText:
      'Count to 30, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty one twenty two twenty three twenty four twenty five twenty six twenty seven twenty eight twenty nine thirty',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'vertical', verticalAlign: 'middle' },
    seedFieldMeta: { type: 'text', overflow: 'vertical', verticalAlign: 'middle' },
    page: 7,
    ...calculateExplicitVerticalPosition(1),
    customText:
      'Count to 30, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty one twenty two twenty three twenty four twenty five twenty six twenty seven twenty eight twenty nine thirty',
  },
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', overflow: 'vertical', verticalAlign: 'bottom' },
    seedFieldMeta: { type: 'text', overflow: 'vertical', verticalAlign: 'bottom' },
    page: 7,
    ...calculateExplicitVerticalPosition(2),
    customText:
      'Count to 30, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty one twenty two twenty three twenty four twenty five twenty six twenty seven twenty eight twenty nine thirty',
  },

  /**
   * @@@@@@@@@@@@@@@@@@@@@@@
   *
   * PAGE 8: CROP MODE
   *
   * @@@@@@@@@@@@@@@@@@@@@@@
   */
  // Box 1: Single-line crop
  {
    type: FieldType.TEXT,
    fieldMeta: undefined,
    seedFieldMeta: { type: 'text' },
    page: 8,
    positionX: 10,
    positionY: 15,
    width: 25,
    height: SINGLE_LINE_HEIGHT,
    customText: 'This text should be cropped and not overflow',
  },
  // Box 2: Multi-line crop
  {
    type: FieldType.TEXT,
    fieldMeta: undefined,
    seedFieldMeta: { type: 'text' },
    page: 8,
    positionX: 10,
    positionY: 30,
    width: 25,
    height: MULTI_LINE_HEIGHT,
    customText:
      'Count to 30, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty one twenty two twenty three twenty four twenty five twenty six twenty seven twenty eight twenty nine thirty',
  },
] as const;
