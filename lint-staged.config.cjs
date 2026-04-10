/** @type {import('lint-staged').Config} */
module.exports = {
  '**/*.{ts,tsx,cts,mts,js,jsx,cjs,mjs,json,css}': 'npm run lint:staged',
  '**/*/package.json': 'npm run precommit',
};
