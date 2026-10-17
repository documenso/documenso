/**
 * Generates `assets/field-groups.pdf`, the document used by the grouped fields E2E tests.
 *
 * Run with: `npx tsx packages/app-tests/scripts/generate-field-groups-pdf.ts`
 *
 * The layout is driven by `@documenso/lib/constants/test-pdfs/field-groups-pdf-layout.ts`, which is also used to
 * position the fields, so regenerate the PDF whenever that layout changes.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  calculateFieldGroupsPdfCell,
  FIELD_GROUPS_PDF_GRID,
  FIELD_GROUPS_PDF_PAGE,
  FIELD_GROUPS_PDF_PAGES,
} from '@documenso/lib/constants/test-pdfs/field-groups-pdf-layout';
import { PDF, rgb } from '@libpdf/core';

const OUTPUT_PATH = path.join(__dirname, '../../../assets/field-groups.pdf');
const FONT_DIR = path.join(__dirname, '../../../apps/remix/public/fonts');

const COLORS = {
  text: rgb(0.1, 0.1, 0.1),
  muted: rgb(0.45, 0.45, 0.45),
  cellBorder: rgb(0.75, 0.75, 0.75),
  cellFill: rgb(0.97, 0.97, 0.97),
};

const percentToPoints = (percentX: number, percentY: number, percentWidth: number, percentHeight: number) => {
  const { width: pageWidth, height: pageHeight } = FIELD_GROUPS_PDF_PAGE;

  const width = (percentWidth / 100) * pageWidth;
  const height = (percentHeight / 100) * pageHeight;
  const x = (percentX / 100) * pageWidth;

  // PDF coordinates start at the bottom left, field positions at the top left.
  const y = pageHeight - (percentY / 100) * pageHeight - height;

  return { x, y, width, height };
};

const generate = async () => {
  const pdf = PDF.create();

  const regularFont = pdf.embedFont(new Uint8Array(fs.readFileSync(path.join(FONT_DIR, 'inter-regular.ttf'))));
  const boldFont = pdf.embedFont(new Uint8Array(fs.readFileSync(path.join(FONT_DIR, 'inter-bold.ttf'))));

  FIELD_GROUPS_PDF_PAGES.forEach((pageSpec, pageIndex) => {
    const page = pdf.addPage({ size: 'letter' });

    const { width: pageWidth, height: pageHeight } = FIELD_GROUPS_PDF_PAGE;
    const marginX = (FIELD_GROUPS_PDF_GRID.startX / 100) * pageWidth;

    page.drawText(`${pageIndex + 1}. ${pageSpec.title}`, {
      x: marginX,
      y: pageHeight - 50,
      size: 20,
      font: boldFont,
      color: COLORS.text,
    });

    page.drawText(pageSpec.description, {
      x: marginX,
      y: pageHeight - 72,
      size: 10,
      font: regularFont,
      color: COLORS.muted,
      maxWidth: pageWidth - marginX * 2,
    });

    pageSpec.rows.forEach((row, rowIndex) => {
      const firstCell = calculateFieldGroupsPdfCell(rowIndex, 0, row.cells[0]);
      const labelPosition = percentToPoints(firstCell.positionX, firstCell.positionY, 0, 0);

      page.drawText(row.label, {
        x: labelPosition.x,
        y: labelPosition.y + 5,
        size: 9,
        font: regularFont,
        color: COLORS.muted,
      });

      row.cells.forEach((cellWidth, columnIndex) => {
        const cell = calculateFieldGroupsPdfCell(rowIndex, columnIndex, cellWidth);
        const { x, y, width, height } = percentToPoints(cell.positionX, cell.positionY, cell.width, cell.height);

        page.drawRectangle({
          x,
          y,
          width,
          height,
          color: COLORS.cellFill,
          borderColor: COLORS.cellBorder,
          borderWidth: 1,
          borderDashArray: [3, 3],
        });
      });
    });

    page.drawText(`Page ${pageIndex + 1} of ${FIELD_GROUPS_PDF_PAGES.length}`, {
      x: marginX,
      y: 30,
      size: 8,
      font: regularFont,
      color: COLORS.muted,
    });
  });

  const bytes = await pdf.save();

  fs.writeFileSync(OUTPUT_PATH, bytes);

  console.log(`Wrote ${FIELD_GROUPS_PDF_PAGES.length} pages to ${OUTPUT_PATH}`);
};

void generate();
