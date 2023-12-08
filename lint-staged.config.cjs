module.exports = {
  '**/*.{js,jsx,cjs,mjs,ts,tsx,cts,mts}': ['prettier --write', 'eslint --fix'],
  '**/*.{yml,mdx}': ['prettier --write'],
};
