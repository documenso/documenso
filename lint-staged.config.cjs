/** @type {import('lint-staged').Config} */
module.exports = {
  '**/*.{ts,tsx,cts,mts}': (files) => `eslint --fix ${files.join(' ')}`,
  '**/*.{js,jsx,cjs,mjs}': (files) => `prettier --write ${files.join(' ')}`,
  '**/*.{yml,mdx}': (files) => `prettier --write ${files.join(' ')}`,
  '**/*/package.json': 'npm run precommit',
};
