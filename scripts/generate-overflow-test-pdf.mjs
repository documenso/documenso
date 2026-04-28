// scripts/generate-overflow-test-pdf.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Helper functions to generate HTML for each page ---

function box(left, top, width, height) {
  return `left:${left}%;top:${top}%;width:${width}%;height:${height}%;`;
}

function labelStyle(left, top) {
  return `left:${left}%;top:${top}%;`;
}

function makeBox(left, top, width, height, label, { labelBelow = false } = {}) {
  const labelTop = labelBelow ? top + height + 0.5 : top - 1.5;
  return `
    <div class="label" style="${labelStyle(left, labelTop)}">${label}</div>
    <div class="box" style="${box(left, top, width, height)}"></div>`;
}

// --- Pages 1-2: Date / Email (3×3 multi-line grid with text align variants) ---

function makeFieldOverflowPageWithGrid(title) {
  const startX = 10;
  const boxWidth = 35;

  // Section A: Single-line height
  const slHeight = 1.75;
  const slStartY = 15;
  const slRowSpacing = 8;
  const sectionARows = [
    { y: slStartY, label: 'M_AUTO TA_LEFT VA_MIDDLE' },
    { y: slStartY + slRowSpacing, label: 'M_AUTO TA_LEFT VA_MIDDLE' },
    { y: slStartY + 2 * slRowSpacing, label: 'M_AUTO TA_LEFT VA_MIDDLE' },
  ];

  // Section B: Multi-line height — 3×3 grid
  // Rows: TA_LEFT, TA_CENTER, TA_RIGHT
  // Columns: short, medium, long text
  const mlHeight = 12;
  const mlBoxWidth = 30;
  const mlColumnX = [2.5, 35, 67.5];
  const mlRowY = [45, 63, 83];
  const mlTextAligns = ['LEFT', 'CENTER', 'RIGHT'];

  let content = `
    <div class="title" style="top:3%;left:10%;">${title}</div>`;

  for (const r of sectionARows) {
    content += makeBox(startX, r.y, boxWidth, slHeight, r.label);
  }

  for (let ri = 0; ri < 3; ri++) {
    for (let ci = 0; ci < 3; ci++) {
      const label = `M_AUTO TA_${mlTextAligns[ri]} VA_MIDDLE`;
      content += makeBox(mlColumnX[ci], mlRowY[ri], mlBoxWidth, mlHeight, label);
    }
  }

  return content;
}

// --- Page 3: Signature (stacked multi-line, no text align control) ---

function makeSignatureOverflowPage(title) {
  const startX = 10;
  const boxWidth = 35;

  // Section A: Single-line height
  const slHeight = 1.75;
  const slStartY = 15;
  const slRowSpacing = 8;
  const sectionARows = [
    { y: slStartY, label: 'M_AUTO TA_CENTER VA_MIDDLE' },
    { y: slStartY + slRowSpacing, label: 'M_AUTO TA_CENTER VA_MIDDLE' },
    { y: slStartY + 2 * slRowSpacing, label: 'M_AUTO TA_CENTER VA_MIDDLE' },
  ];

  // Section B: Multi-line height — stacked single column
  const mlHeight = 12;
  const mlStartY = 45;
  const mlRowSpacing = 18;
  const sectionBRows = [
    { y: mlStartY, label: 'M_AUTO TA_CENTER VA_MIDDLE' },
    { y: mlStartY + mlRowSpacing, label: 'M_AUTO TA_CENTER VA_MIDDLE' },
    { y: mlStartY + 2 * mlRowSpacing, label: 'M_AUTO TA_CENTER VA_MIDDLE' },
  ];

  let content = `
    <div class="title" style="top:3%;left:10%;">${title}</div>`;

  for (const r of sectionARows) {
    content += makeBox(startX, r.y, boxWidth, slHeight, r.label);
  }

  for (const r of sectionBRows) {
    content += makeBox(startX, r.y, boxWidth, mlHeight, r.label);
  }

  return content;
}

// --- Pages 4-5: Text Field Auto Mode ---

function makeTextAutoPage(title, boxHeight, isSingleLine) {
  const boxWidth = 28;

  const columns = [
    { col: 0, x: 5, textAlign: 'left' },
    { col: 1, x: 35.5, textAlign: 'center' },
    { col: 2, x: 66, textAlign: 'right' },
  ];

  const verticalAligns = ['top', 'middle', 'bottom'];

  let content = `
    <div class="title" style="top:3%;left:5%;">${title}</div>`;

  if (isSingleLine) {
    // Single-line: stagger all 9 items evenly down the page.
    // Each item gets its own Y position to avoid horizontal overflow collision.
    const itemCount = 9; // 3 rows × 3 columns
    const startY = 10;
    const endY = 92;
    const spacing = (endY - startY) / (itemCount - 1);

    let itemIndex = 0;
    for (let ri = 0; ri < 3; ri++) {
      for (let ci = 0; ci < columns.length; ci++) {
        const col = columns[ci];
        const y = startY + itemIndex * spacing;
        const label = `M_AUTO TA_${col.textAlign.toUpperCase()} VA_${verticalAligns[ri].toUpperCase()}`;
        content += makeBox(col.x, y, boxWidth, boxHeight, label);
        itemIndex++;
      }
    }
  } else {
    // Multi-line: 3 rows evenly spaced, bottom row near page bottom.
    // Box is 12% tall. Top of last box at 80% so bottom edge is at 92%.
    const startY = 10;
    const lastRowY = 80; // 80 + 12 = 92% (page bottom with padding)
    const midY = (startY + lastRowY) / 2; // 45%
    const rowYPositions = [startY, midY, lastRowY];

    for (let ri = 0; ri < 3; ri++) {
      const labelBelow = verticalAligns[ri] === 'bottom';

      for (const col of columns) {
        const label = `M_AUTO TA_${col.textAlign.toUpperCase()} VA_${verticalAligns[ri].toUpperCase()}`;
        content += makeBox(col.x, rowYPositions[ri], boxWidth, boxHeight, label, { labelBelow });
      }
    }
  }

  return content;
}

// --- Page 6: Explicit Modes ---

function makePage6() {
  const boxWidth = 25;

  let content = `
    <div class="title" style="top:3%;left:5%;">Text Field Explicit Modes</div>
`;

  // Section A: Horizontal mode — centered on page, staggered vertically
  const centeredX = (100 - boxWidth) / 2; // 37.5%
  const horizontalRows = [
    { x: centeredX, y: 15, label: 'M_HORIZONTAL TA_LEFT VA_TOP' },
    { x: centeredX, y: 21, label: 'M_HORIZONTAL TA_CENTER VA_TOP' },
    { x: centeredX, y: 27, label: 'M_HORIZONTAL TA_RIGHT VA_TOP' },
  ];

  for (const r of horizontalRows) {
    content += makeBox(r.x, r.y, boxWidth, 1.75, r.label);
  }

  // Section B: Vertical mode — place side by side so vertical overflow has room below
  content += '';

  const verticalCols = [
    { x: 5, y: 43, label: 'M_VERTICAL TA_LEFT VA_TOP', labelBelow: false },
    { x: 37.5, y: 43, label: 'M_VERTICAL TA_LEFT VA_MIDDLE', labelBelow: false },
    { x: 70, y: 43, label: 'M_VERTICAL TA_LEFT VA_BOTTOM', labelBelow: true },
  ];

  for (const c of verticalCols) {
    content += makeBox(c.x, c.y, boxWidth, 12, c.label, { labelBelow: c.labelBelow });
  }

  return content;
}

// --- Page 7: Crop Mode ---

function makePage7() {
  return `
    <div class="title" style="top:3%;left:10%;">Crop Mode (no overflow)</div>
    ${makeBox(10, 15, 25, 1.75, 'M_CROP TA_LEFT VA_TOP')}
    ${makeBox(10, 30, 25, 12, 'M_CROP TA_LEFT VA_TOP')}`;
}

// --- Assemble all pages ---

function buildPage(contentFn) {
  return `<div class="page">${typeof contentFn === 'string' ? contentFn : contentFn}</div>`;
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
  .section-label { position: absolute; font-size: 12px; font-weight: bold; color: #666; }
  .box { position: absolute; border: 1px solid black; box-sizing: border-box; }
  .label { position: absolute; font-size: 9px; color: red; font-weight: bold; z-index: 9999; }
</style>
</head>
<body>
  ${buildPage(makeFieldOverflowPageWithGrid('Date Field Overflow Tests'))}
  ${buildPage(makeFieldOverflowPageWithGrid('Email Field Overflow Tests'))}
  ${buildPage(makeSignatureOverflowPage('Signature Field Overflow Tests'))}
  ${buildPage(makeTextAutoPage('Text Field Auto - Single-line Height', 1.75, true))}
  ${buildPage(makeTextAutoPage('Text Field Auto - Multi-line Height', 12, false))}
  ${buildPage(makeTextAutoPage('Text Field Auto - Multi-line Height Overflow', 12, false))}
  ${buildPage(makePage6())}
  ${buildPage(makePage7())}
</body>
</html>`;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.setContent(html, { waitUntil: 'networkidle' });

  const outputPath = path.join(__dirname, '../assets/field-overflow.pdf');

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });

  await browser.close();
  console.log(`PDF generated: assets/field-overflow.pdf`);
}

main().catch(console.error);
