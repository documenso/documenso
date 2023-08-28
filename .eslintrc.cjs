/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['@documenso/eslint-config'],
  rules: {
    '@next/next/no-img-element': 'off',
  },
  settings: {
    next: {
      rootDir: ['apps/*/'],
    },
  },
  overrides: [
    {
      files: ['**/*.ts*'],
      excludedFiles: '../packages/eslint-config/index.cjs',
    },
  ],
};
