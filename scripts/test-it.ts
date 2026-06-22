/**
 * Automated check for issue #2887 (CC completed-document emails).
 *
 * Run from repo root:
 *   npx tsx scripts/test-it.ts
 *
 * Optional: pass a PDF path to verify it can be read (sanity check only):
 *   npx tsx scripts/test-it.ts ~/Desktop/Neel_Manro_Resume.pdf
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const libRoot = path.join(repoRoot, 'packages/lib');

const pdfArg = process.argv[2];

if (pdfArg) {
  const pdfPath = path.resolve(pdfArg);

  if (!fs.existsSync(pdfPath)) {
    console.error(`PDF not found: ${pdfPath}`);
    process.exit(1);
  }

  const bytes = fs.readFileSync(pdfPath);
  const isPdf = bytes.slice(0, 4).toString() === '%PDF';

  console.log(`PDF: ${pdfPath}`);
  console.log(`Size: ${bytes.length} bytes`);
  console.log(`Valid PDF header: ${isPdf ? 'yes' : 'no'}`);

  if (!isPdf) {
    console.error('File is not a PDF — pick a .pdf file for the sanity check.');
    process.exit(1);
  }

  console.log('');
}

console.log('Running automated CC completed-email tests...\n');

const vitest = spawnSync(
  'npx',
  [
    'vitest',
    'run',
    'utils/document-completed-email-recipients.test.ts',
    'jobs/definitions/emails/send-document-completed-emails.handler.test.ts',
  ],
  {
    cwd: libRoot,
    stdio: 'inherit',
    env: process.env,
  },
);

if (vitest.status !== 0) {
  process.exit(vitest.status ?? 1);
}

console.log('\nAll automated checks passed.');
console.log('Manual Inbucket check (optional): confirm cc@test.documenso.com received "Signing Complete!".');
