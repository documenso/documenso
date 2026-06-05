#!/usr/bin/env node
/**
 * Generates the Guest Speaker Request & Approval Form PDF used by the reusable
 * Documenso template (see packages/prisma/seed/guest-speaker-template.ts).
 *
 * Pure Node — no external dependencies — so the committed asset can be
 * regenerated in any environment. The signature/date/name field coordinates in
 * the provisioning script are kept in sync with the lines drawn here.
 *
 * Usage: node scripts/generate-guest-speaker-pdf.cjs
 * Output: assets/guest-speaker-form.pdf
 */
const fs = require('node:fs');
const path = require('node:path');

const PAGE_W = 612; // US Letter, portrait
const PAGE_H = 792;

/** Escape characters that are special inside a PDF string literal. */
const esc = (str) => str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/** y is measured from the TOP of the page so it matches Documenso field coords. */
const text = (x, yTop, str, size, bold = false) =>
  `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${PAGE_H - yTop} Td (${esc(str)}) Tj ET\n`;

const line = (x1, yTop, x2, yTop2 = yTop) =>
  `${x1} ${PAGE_H - yTop} m ${x2} ${PAGE_H - yTop2} l S\n`;

const ops = [];
ops.push('0.7 w\n'); // default stroke width for the underlines

// Header
ops.push(text(60, 72, 'Guest Speaker Request & Approval Form', 18, true));
ops.push(text(60, 96, 'Peninsula School District', 11));
ops.push(
  text(60, 122, 'Complete the speaker details below, then route for the required signatures.', 10),
);
ops.push(line(60, 134, 552, 134));

// Event details — one labelled, underlined field per row.
const detailRows = [
  [160, 'Speaker Name:'],
  [195, 'Speaker Organization:'],
  [230, 'Presentation Topic:'],
  [265, 'Presentation Date(s):'],
  [300, 'Building / School:'],
];
for (const [yTop, label] of detailRows) {
  ops.push(text(60, yTop, label, 11, true));
  ops.push(line(200, yTop + 4, 552, yTop + 4));
}

// Signatures section
ops.push(line(60, 345, 552, 345));
ops.push(text(60, 372, 'Signatures', 13, true));
ops.push(
  text(60, 392, 'This request is routed for signature in order: requesting staff, then approval.', 9),
);

// Requesting Staff block
ops.push(text(60, 420, '1. Requesting Staff Member', 11, true));
ops.push(line(60, 462, 300, 462)); // signature line
ops.push(text(60, 476, 'Signature', 9));
ops.push(line(320, 462, 552, 462)); // printed name line
ops.push(text(320, 476, 'Printed Name', 9));
ops.push(line(60, 507, 300, 507)); // date line
ops.push(text(60, 521, 'Date', 9));

// Administrator approval block
ops.push(text(60, 560, '2. Building Administrator (Approval)', 11, true));
ops.push(line(60, 617, 300, 617)); // signature line
ops.push(text(60, 631, 'Signature', 9));
ops.push(line(320, 617, 552, 617)); // printed name line
ops.push(text(320, 631, 'Printed Name', 9));
ops.push(line(60, 662, 300, 662)); // date line
ops.push(text(60, 676, 'Date', 9));

const content = ops.join('');

// Assemble the PDF objects, tracking byte offsets for the xref table.
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
    '/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
  `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}endstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
];

let pdf = '%PDF-1.4\n';
const offsets = [];
objects.forEach((body, i) => {
  offsets.push(Buffer.byteLength(pdf, 'latin1'));
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});

const xrefStart = Buffer.byteLength(pdf, 'latin1');
pdf += `xref\n0 ${objects.length + 1}\n`;
pdf += '0000000000 65535 f \n';
for (const off of offsets) {
  pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
}
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
pdf += `startxref\n${xrefStart}\n%%EOF\n`;

const outPath = path.join(__dirname, '..', 'assets', 'guest-speaker-form.pdf');
fs.writeFileSync(outPath, Buffer.from(pdf, 'latin1'));
console.log(`Wrote ${outPath} (${Buffer.byteLength(pdf, 'latin1')} bytes)`);
