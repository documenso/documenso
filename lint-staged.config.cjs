const path = require('path');

const biome = (filenames) =>
  `biome check --write --no-errors-on-unmatched ${filenames.map((f) => `"${path.relative(process.cwd(), f)}"`).join(' ')}`;

/** @type {import('lint-staged').Config} */
module.exports = {
  '**/*.{ts,tsx,cts,mts,js,jsx,cjs,mjs,json,css}': [biome],
  '**/*/package.json': 'npm run precommit',
};
