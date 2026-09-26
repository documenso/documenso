// scripts/generate-content-alignment-test-pdf.mjs
//
// Generates `assets/content-alignment.pdf`, the document the content
// alignment visual regression test places its contents on. There is one page
// per content type, each printing a labelled grid of boxes which the contents
// of the test fixture (`packages/app-tests/constants/content-alignment-pdf.ts`)
// target, so misplacement is visible against the printed box.
//
// Keep the grid and page order in sync with `CONTENT_ALIGNMENT_GRID` and
// `CONTENT_ALIGNMENT_PAGES` in that fixture.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Grid, as percentages of the page ---

const GRID = {
  startX: 8,
  startY: 12,
  columnWidth: 28,
  columnGap: 1,
  rowHeight: 7,
  rowGap: 1,
};

const cellLeft = (column) => GRID.startX + column * (GRID.columnWidth + GRID.columnGap);
const cellTop = (row) => GRID.startY + row * (GRID.rowHeight + GRID.rowGap);

function makeCell(row, column, label, { rows = 1, columns = 1 } = {}) {
  const left = cellLeft(column);
  const top = cellTop(row);
  const width = columns * GRID.columnWidth + (columns - 1) * GRID.columnGap;
  const height = rows * GRID.rowHeight + (rows - 1) * GRID.rowGap;

  return `
    <div class="label" style="left:${left}%;top:${top - 1.4}%;">${label}</div>
    <div class="box" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;"></div>`;
}

function makeRowLabel(row, label) {
  return `<div class="row-label" style="left:1%;top:${cellTop(row) + 0.5}%;">${label}</div>`;
}

function makeTitle(title) {
  return `<div class="title" style="top:3%;left:8%;">${title}</div>`;
}

// --- Page 1: Text ---

function makeTextPage() {
  let content = makeTitle('Content Alignment - Text');

  content += makeRowLabel(0, 'TEXT ALIGN');
  content += makeCell(0, 0, 'TA_LEFT');
  content += makeCell(0, 1, 'TA_CENTER');
  content += makeCell(0, 2, 'TA_RIGHT');

  content += makeRowLabel(1, 'VERT ALIGN');
  content += makeCell(1, 0, 'VA_TOP', { rows: 2 });
  content += makeCell(1, 1, 'VA_MIDDLE', { rows: 2 });
  content += makeCell(1, 2, 'VA_BOTTOM', { rows: 2 });

  content += makeRowLabel(3, 'FONT SIZE');
  content += makeCell(3, 0, 'SIZE_8');
  content += makeCell(3, 1, 'SIZE_14 RED');
  content += makeCell(3, 2, 'SIZE_24 CROPPED');

  content += makeRowLabel(4, 'SPACING');
  content += makeCell(4, 0, 'LINE_HEIGHT_1.6');
  content += makeCell(4, 1, 'LETTER_SPACING_3');
  content += makeCell(4, 2, 'WRAPPED', { rows: 2 });

  content += makeRowLabel(6, 'ROTATION');
  content += makeCell(6, 0, 'ROTATED_15', { rows: 2 });
  content += makeCell(6, 1, 'ROTATED_90', { rows: 2, columns: 1 });

  return content;
}

// --- Page 2: Lines ---

function makeLinePage() {
  let content = makeTitle('Content Alignment - Lines');

  content += makeRowLabel(0, 'STYLE');
  content += makeCell(0, 0, 'SOLID_1');
  content += makeCell(0, 1, 'DASHED_2');
  content += makeCell(0, 2, 'DOTTED_3');

  content += makeRowLabel(1, 'WIDTH');
  content += makeCell(1, 0, 'WIDTH_0.5');
  content += makeCell(1, 1, 'WIDTH_5');
  content += makeCell(1, 2, 'WIDTH_10');

  content += makeRowLabel(2, 'DIAGONAL');
  content += makeCell(2, 0, 'TOP_LEFT TO BOTTOM_RIGHT', { columns: 3, rows: 2 });

  content += makeRowLabel(4, 'DIAGONAL');
  content += makeCell(4, 0, 'BOTTOM_LEFT TO TOP_RIGHT', { columns: 3, rows: 2 });

  content += makeRowLabel(6, 'VERTICAL');
  content += makeCell(6, 0, 'VERTICAL_CENTER', { rows: 2 });
  content += makeCell(6, 1, 'VERTICAL_LEFT_EDGE', { rows: 2 });
  content += makeCell(6, 2, 'COLORED_RED', { rows: 2 });

  return content;
}

// --- Page 3: Shapes ---

function makeShapePage() {
  let content = makeTitle('Content Alignment - Shapes');

  content += makeRowLabel(0, 'STROKE');
  content += makeCell(0, 0, 'STROKE_RED_2');
  content += makeCell(0, 1, 'STROKE_DASHED_1');
  content += makeCell(0, 2, 'STROKE_DOTTED_4');

  content += makeRowLabel(1, 'FILL');
  content += makeCell(1, 0, 'FILL_YELLOW');
  content += makeCell(1, 1, 'FILL_GREEN_40%');
  content += makeCell(1, 2, 'FILL_BLUE_NO_STROKE');

  content += makeRowLabel(2, 'SIZE');
  content += makeCell(2, 0, 'SQUARE', { rows: 2 });
  content += makeCell(2, 1, 'FULL_WIDTH_BELOW', { columns: 2 });

  content += makeRowLabel(4, 'ROTATION');
  content += makeCell(4, 0, 'ROTATED_15', { rows: 2 });
  content += makeCell(4, 1, 'ROTATED_45', { rows: 2 });
  content += makeCell(4, 2, 'ROTATED_90', { rows: 2 });

  // Two overlapping filled rectangles per cell. The one created first has the
  // higher zIndex, so it must render on top despite creation order.
  content += makeRowLabel(6, 'STACKING');
  content += makeCell(6, 0, 'RED_ON_TOP (zIndex 2 over 1)', { rows: 2 });
  content += makeCell(6, 1, 'BLUE_ON_TOP (zIndex 5 over 0)', { rows: 2 });
  content += makeCell(6, 2, 'TIE (equal zIndex, id order)', { rows: 2 });

  return content;
}

// --- Page 4: Highlights ---

function makeHighlightPage() {
  let content = makeTitle('Content Alignment - Highlights');

  content += makeRowLabel(0, 'COLOR');
  content += makeCell(0, 0, 'YELLOW_40%');
  content += makeCell(0, 1, 'GREEN_40%');
  content += makeCell(0, 2, 'PINK_40%');

  content += makeRowLabel(1, 'OPACITY');
  content += makeCell(1, 0, 'OPACITY_10%');
  content += makeCell(1, 1, 'OPACITY_60%');
  content += makeCell(1, 2, 'OPACITY_100%');

  content += makeRowLabel(2, 'OVER TEXT');
  content += makeCell(2, 0, 'HIGHLIGHT OVER THIS PRINTED TEXT', { columns: 3 });
  content += `<div class="body-text" style="left:${cellLeft(0) + 1}%;top:${cellTop(2) + 2}%;">The quick brown fox jumps over the lazy dog. A highlight is drawn over this line.</div>`;

  content += makeRowLabel(3, 'ROTATION');
  content += makeCell(3, 0, 'ROTATED_15', { rows: 2 });
  content += makeCell(3, 1, 'ROTATED_45', { rows: 2 });

  return content;
}

// --- Page 5: Images ---

function makeImagePage() {
  let content = makeTitle('Content Alignment - Images');

  content += makeRowLabel(0, 'FIT');
  content += makeCell(0, 0, 'WIDE_BOX (FILLS WIDTH)', { rows: 2 });
  content += makeCell(0, 1, 'SQUARE_BOX (LETTERBOXED)', { rows: 2 });
  content += makeCell(0, 2, 'TALL_BOX (CENTERED)', { rows: 3 });

  content += makeRowLabel(3, 'SIZE');
  content += makeCell(3, 0, 'FULL_WIDTH', { columns: 3, rows: 2 });

  content += makeRowLabel(5, 'ROTATION');
  content += makeCell(5, 0, 'ROTATED_15', { rows: 2 });
  content += makeCell(5, 1, 'ROTATED_45', { rows: 2 });
  content += makeCell(5, 2, 'ROTATED_90', { rows: 2 });

  content += makeRowLabel(7, 'EDGE');
  content += makeCell(7, 0, 'ROTATED_180', { rows: 2 });
  content += makeCell(7, 1, 'ROTATED_270', { rows: 2 });

  return content;
}

function buildPage(content) {
  return `<div class="page">${content}</div>`;
}

const html = `<!DOCTYPE html>
<html>
<head>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: sans-serif; font-size: 10px; }
  .page { width: 210mm; height: 297mm; position: relative; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .title { position: absolute; font-size: 18px; font-weight: bold; }
  .row-label { position: absolute; font-size: 7px; font-weight: bold; color: #666; width: 6%; }
  .body-text { position: absolute; font-size: 11px; color: #333; }
  .box { position: absolute; border: 1px solid #999; box-sizing: border-box; }
  .label { position: absolute; font-size: 7px; color: #c00; font-weight: bold; z-index: 9999; }
</style>
</head>
<body>
  ${buildPage(makeTextPage())}
  ${buildPage(makeLinePage())}
  ${buildPage(makeShapePage())}
  ${buildPage(makeHighlightPage())}
  ${buildPage(makeImagePage())}
</body>
</html>`;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.setContent(html, { waitUntil: 'networkidle' });

  const outputPath = path.join(__dirname, '../assets/content-alignment.pdf');

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });

  await browser.close();
  console.log('PDF generated: assets/content-alignment.pdf');
}

main().catch(console.error);
