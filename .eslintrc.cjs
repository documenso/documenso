/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['@documenso/eslint-config'],
  rules: {
    '@next/next/no-img-element': 'off',
    'no-unreachable': 'error',
    'react-hooks/exhaustive-deps': 'off',
  },
  settings: {
    next: {
      rootDir: ['apps/*/'],
    },
  },
  ignorePatterns: ['lingui.config.ts', 'packages/lib/translations/**/*.js'],
};
