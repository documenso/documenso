const path = require('path');

const eslint = (filenames) =>
  `eslint --fix ${filenames.map((f) => `"${path.relative(process.cwd(), f)}"`).join(' ')}`;

const prettier = (filenames) =>
  `prettier --write ${filenames.map((f) => `"${path.relative(process.cwd(), f)}"`).join(' ')}`;

/** @type {import('lint-staged').Config} */
module.exports = {
  '**/*.{ts,tsx,cts,mts}': [eslint, prettier],
  '**/*.{js,jsx,cjs,mjs}': [prettier],
  '**/*.{yml,mdx}': [prettier],
  '**/*/package.json': 'npm run precommit',
};
