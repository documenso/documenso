/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: [
    '@documenso/eslint-config',
    'plugin:package-json/recommended',
    'plugin:import/recommended',
  ],
  plugins: ['package-json', 'import', 'simple-import-sort'],
  rules: {
    '@next/next/no-img-element': 'off',
    'no-multi-spaces': [
      'error',
      {
        ignoreEOLComments: false,
        exceptions: {
          BinaryExpression: false,
          VariableDeclarator: false,
          ImportDeclaration: false,
          Property: false,
        },
      },
    ],
    'import/named': 'off',
    'no-duplicate-imports': 'error',
  },
  settings: {
    next: {
      rootDir: ['apps/*/'],
    },
  },
};
