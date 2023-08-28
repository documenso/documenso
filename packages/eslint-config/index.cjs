module.exports = {
  extends: [
    'next',
    'turbo',
    'prettier',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:prettier/recommended',
    'async',
    'async/node',
    'async/typescript',
  ],

  plugins: ['eslint-plugin-node', 'prettier'],

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
    '@typescript-eslint/no-redeclare': ['error'],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/require-await': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/promise-function-async': 'error',
    'node/handle-callback-err': 'error',
    'node/no-callback-literal': 'error',
    'node/no-sync': 'error',
    'no-return-await': 'error',
    'no-await-in-loop': 'error',
    'no-async-promise-executor': 'error',
    'no-promise-executor-return': 'error',
    'require-atomic-updates': 'error',
    'prefer-promise-reject-errors': 'error',

    // We never want to use `as` but are required to on occasion to handle
    // shortcomings in third-party and generated types.
    //
    // To handle this we want this rule to catch usages and highlight them as
    // warnings so we can write appropriate interfaces and guards later.
    '@typescript-eslint/consistent-type-assertions': ['warn', { assertionStyle: 'never' }],
  },
};
