const path = require('path');

const oxlint = (filenames) =>
  `oxlint --fix ${filenames.map((f) => `"${path.relative(process.cwd(), f)}"`).join(' ')}`;

const oxfmt = (filenames) =>
  `oxfmt --write ${filenames.map((f) => `"${path.relative(process.cwd(), f)}"`).join(' ')}`;

module.exports = {
  '**/*.{ts,tsx,cts,mts}': [oxlint, oxfmt],
  '**/*.{js,jsx,cjs,mjs}': [oxfmt],
  '**/*.{yml,mdx}': [oxfmt],
  '**/*/package.json': 'npm run precommit',
};
