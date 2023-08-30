module.exports = {
  extends: [
    'next',
    'turbo',
    'prettier',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'plugin:package-json/recommended',
  ],

  plugins: ['prettier', 'package-json'],

  env: {
    node: true,
    browser: true,
    es6: true,
  },

  parser: '@typescript-eslint/parser',

  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['../../apps/*/tsconfig.json', '../../packages/*/tsconfig.json'],
    ecmaVersion: 2022,
    ecmaFeatures: {
      jsx: true,
    },
    sourceType: 'module',
  },

  rules: {
    'react/no-unescaped-entities': 'off',

    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

    'no-duplicate-imports': 'error',
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

    // Safety with promises so we aren't running with scissors
    'no-promise-executor-return': 'error',
    'prefer-promise-reject-errors': 'error',
    'require-atomic-updates': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': [
      'error',
      { checksVoidReturn: { attributes: false } },
    ],
    '@typescript-eslint/promise-function-async': 'error',
    '@typescript-eslint/require-await': 'error',

    // We never want to use `as` but are required to on occasion to handle
    // shortcomings in third-party and generated types.
    //
    // To handle this we want this rule to catch usages and highlight them as
    // warnings so we can write appropriate interfaces and guards later.
    '@typescript-eslint/consistent-type-assertions': ['warn', { assertionStyle: 'never' }],
  },
};
