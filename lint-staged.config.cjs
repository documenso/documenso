const path = require('path');

const buildEslintCommand = (filenames) =>
  `eslint --fix ${filenames.map((f) => `"${path.relative(process.cwd(), f)}"`).join(' ')}`;

const buildPrettierCommand = (filenames) =>
  `prettier --write ${filenames.map((f) => `"${path.relative(process.cwd(), f)}"`).join(' ')}`;

/** @type {import('lint-staged').Config} */
module.exports = {
  '**/*.{ts,tsx,cts,mts}': [buildEslintCommand, buildPrettierCommand],
  '**/*.{js,jsx,cjs,mjs}': [buildPrettierCommand],
  '**/*.{yml,mdx}': [buildPrettierCommand],
  '**/*/package.json': 'npm run precommit',
};
