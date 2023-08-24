/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['@documenso/eslint-config', 'plugin:jsx-a11y/recommended'],
  rules: {
    '@next/next/no-img-element': 'off',
  },
  settings: {
    next: {
      rootDir: ['apps/*/'],
    },
  },
};
