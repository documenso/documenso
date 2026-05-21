// scripts/generate-acroform-test-pdf.mjs
//
// Generates the AcroForm import fixture PDFs used by the test suite.
// Run via:  node scripts/generate-acroform-test-pdf.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PDF } from '@libpdf/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.resolve(__dirname, '..', 'assets');

const LETTER_WIDTH = 612;
const LETTER_HEIGHT = 792;

/**
 * Build the base fixture: one of each supported AcroForm field type with a
 * mix of name heuristics so the type-resolution heuristic gets exercised.
 */
async function buildBaseFixture({ rotation = 0 } = {}) {
  const pdf = PDF.create();

  pdf.addPage({ width: LETTER_WIDTH, height: LETTER_HEIGHT, rotate: rotation });
  pdf.addPage({ width: LETTER_WIDTH, height: LETTER_HEIGHT, rotate: rotation });

  const page1 = pdf.getPage(0);
  const page2 = pdf.getPage(1);

  const form = pdf.getOrCreateForm();

  // Page 1: text (NAME heuristic), text (DATE heuristic), checkbox.
  // Note: SignatureField widgets can't be drawn without going through libpdf's
  // PDFSignature path. Production PDFs (Adobe Acrobat etc.) supply the widget
  // themselves; covered via unit-test mocks rather than this generator.

  const customerName = form.createTextField('CustomerName');
  page1.drawField(customerName, { x: 80, y: 620, width: 200, height: 24 });

  const signedDate = form.createTextField('signed_date');
  page1.drawField(signedDate, { x: 80, y: 560, width: 200, height: 24 });

  const acceptTerms = form.createCheckbox('accept_terms', { onValue: 'Yes' });
  page1.drawField(acceptTerms, { x: 80, y: 500, width: 18, height: 18 });

  // Page 2: dropdown, radio (3 options), text (INITIALS), text (EMAIL),
  // text (NUMBER via name + small MaxLen), and a required-readonly text.
  const country = form.createDropdown('country', {
    options: ['USA', 'Canada', 'Germany'],
    defaultValue: 'USA',
  });
  page2.drawField(country, { x: 80, y: 700, width: 200, height: 24 });

  const payment = form.createRadioGroup('payment_method', {
    options: ['Credit Card', 'PayPal', 'Bank Transfer'],
    defaultValue: 'PayPal',
  });
  page2.drawField(payment, { x: 80, y: 640, width: 16, height: 16, option: 'Credit Card' });
  page2.drawField(payment, { x: 80, y: 615, width: 16, height: 16, option: 'PayPal' });
  page2.drawField(payment, { x: 80, y: 590, width: 16, height: 16, option: 'Bank Transfer' });

  const initials = form.createTextField('initials');
  page2.drawField(initials, { x: 80, y: 540, width: 60, height: 24 });

  const email = form.createTextField('contact_email');
  page2.drawField(email, { x: 160, y: 540, width: 220, height: 24 });

  const qty = form.createTextField('item_qty', { maxLength: 4 });
  page2.drawField(qty, { x: 400, y: 540, width: 60, height: 24 });

  return Buffer.from(await pdf.save());
}

function ensureAssetsDir() {
  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }
}

async function main() {
  ensureAssetsDir();

  const base = await buildBaseFixture();
  fs.writeFileSync(path.join(ASSETS_DIR, 'acroform-import-test.pdf'), base);

  const rot90 = await buildBaseFixture({ rotation: 90 });
  fs.writeFileSync(path.join(ASSETS_DIR, 'acroform-import-rotated-90.pdf'), rot90);

  const rot180 = await buildBaseFixture({ rotation: 180 });
  fs.writeFileSync(path.join(ASSETS_DIR, 'acroform-import-rotated-180.pdf'), rot180);

  const rot270 = await buildBaseFixture({ rotation: 270 });
  fs.writeFileSync(path.join(ASSETS_DIR, 'acroform-import-rotated-270.pdf'), rot270);

  console.log('Wrote fixtures to', ASSETS_DIR);
}

await main();
