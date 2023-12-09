module.exports = {
  '**/*.{ts,tsx,cts,mts}': ['eslint --fix'],
  '**/*.{js,jsx,cjs,mjs}': ['prettier --write'],
  '**/*.{yml,mdx}': ['prettier --write'],
  '**/*/package.json': ['npm run precommit'],
};
