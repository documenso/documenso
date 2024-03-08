/** @type {import('lint-staged').Config} */
module.exports = {
  '**/*.{ts,tsx,cts,mts}': (files) => files.map((file) => `eslint --fix ${file}`),
  '**/*.{js,jsx,cjs,mjs}': (files) => files.map((file) => `prettier --write ${file}`),
  '**/*.{yml,mdx}': (files) => files.map((file) => `prettier --write ${file}`),
  '**/*/package.json': 'npm run precommit',
};
