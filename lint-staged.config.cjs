module.exports = {
  '**/*.{js,jsx,cjs,mjs,ts,tsx,cts,mts,mdx}': ['prettier --write'],
};

module.exports = {
  '*.json': ['npm run precommit'],
};