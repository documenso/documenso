/**
 * Shared layout for the grouped fields test PDF (`assets/field-groups.pdf`).
 *
 * The PDF is a US Letter document with a labelled grid of cells on each page. Fields in
 * `field-groups-pdf.ts` are positioned into those cells using the same layout, and the
 * PDF is generated from it by `scripts/generate-field-groups-pdf.ts`, so the two can
 * never drift apart.
 *
 * All positions are percentages of the page, matching how fields are stored.
 */

export const FIELD_GROUPS_PDF_PAGE = {
  width: 612,
  height: 792,
};

/**
 * Column grid used by every page.
 */
export const FIELD_GROUPS_PDF_GRID = {
  columns: 3,
  columnWidth: 25,
  fullColumnWidth: 76,
  rowHeight: 7,
  rowPadding: 2.5,
  startX: 12,
  startY: 14,
  /**
   * Vertical space reserved above each row for its label.
   */
  labelHeight: 2.5,
};

export type TFieldGroupsPdfCell = {
  positionX: number;
  positionY: number;
  width: number;
  height: number;
};

/**
 * Resolves the field position for a grid cell.
 */
export const calculateFieldGroupsPdfCell = (
  row: number,
  column: number,
  width: 'full' | 'column' = 'column',
): TFieldGroupsPdfCell => {
  const { columnWidth, fullColumnWidth, rowHeight, rowPadding, startX, startY, labelHeight } = FIELD_GROUPS_PDF_GRID;

  return {
    height: rowHeight,
    width: width === 'full' ? fullColumnWidth : columnWidth,
    positionX: startX + column * (columnWidth + 0.5),
    positionY: startY + labelHeight + row * (rowHeight + rowPadding + labelHeight),
  };
};

export type TFieldGroupsPdfPageSpec = {
  title: string;
  description: string;
  rows: Array<{
    label: string;
    cells: Array<'full' | 'column'>;
  }>;
};

/**
 * Describes every page of the PDF: a title, a short description, and the labelled rows
 * of cells drawn on it. Each page covers one way fields can be grouped.
 */
export const FIELD_GROUPS_PDF_PAGES: TFieldGroupsPdfPageSpec[] = [
  {
    title: 'Grouped Fields Tests',
    description: 'Each following page covers one group type. Page 1 holds the signature.',
    rows: [{ label: 'Signature', cells: ['column'] }],
  },
  {
    title: 'Text Group',
    description: 'Three required text fields in one group. Filling any one fills all of them.',
    rows: [
      { label: 'Text group (members A, B)', cells: ['column', 'column'] },
      { label: 'Text group (member C, full width)', cells: ['full'] },
      { label: 'Ungrouped optional text', cells: ['column'] },
    ],
  },
  {
    title: 'Number Group',
    description: 'Two number fields sharing a min/max rule. Filling one fills both.',
    rows: [{ label: 'Number group (members A, B)', cells: ['column', 'column'] }],
  },
  {
    title: 'Dropdown, Name and Email Groups',
    description: 'Shared value groups for the remaining field types.',
    rows: [
      { label: 'Dropdown group (members A, B)', cells: ['column', 'column'] },
      { label: 'Name group (members A, B)', cells: ['column', 'column'] },
      { label: 'Email group (members A, B)', cells: ['column', 'column'] },
    ],
  },
  {
    title: 'Radio Group',
    description: 'Options pooled across three fields. Only one option can be selected in the group.',
    rows: [
      { label: 'Radio group (members A, B)', cells: ['column', 'column'] },
      { label: 'Radio group (member C, pre-checked)', cells: ['column'] },
    ],
  },
  {
    title: 'Checkbox Groups',
    description: 'Options pooled across fields. Validation rules apply to the whole group.',
    rows: [
      { label: 'At least 2 across the group (members A, B)', cells: ['column', 'column'] },
      { label: 'Exactly 1 across the group (members A, B)', cells: ['column', 'column'] },
      { label: 'At most 2, optional, pre-checked (members A, B with hidden labels)', cells: ['column', 'column'] },
    ],
  },
  {
    title: 'Cross Page Group',
    description: 'Member of the text group from page 2, to verify groups span pages.',
    rows: [{ label: 'Text group (member D)', cells: ['column'] }],
  },
];
