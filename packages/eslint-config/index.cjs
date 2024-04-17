module.exports = {
  extends: [
    'next',
    'turbo',
<<<<<<< HEAD
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
=======
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:package-json/recommended',
  ],

  plugins: ['package-json', 'unused-imports'],

  env: {
    es2022: true,
    node: true,
    browser: true,
>>>>>>> main
  },

  parser: '@typescript-eslint/parser',

  parserOptions: {
    tsconfigRootDir: __dirname,
<<<<<<< HEAD
    project: ['../../apps/*/tsconfig.json', '../../packages/*/tsconfig.json'],
=======
    project: ['../../tsconfig.eslint.json'],
>>>>>>> main
    ecmaVersion: 2022,
    ecmaFeatures: {
      jsx: true,
    },
    sourceType: 'module',
  },

  rules: {
<<<<<<< HEAD
    'react/no-unescaped-entities': 'off',

    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

    'no-duplicate-imports': 'error',
=======
    '@next/next/no-html-link-for-pages': 'off',
    'react/no-unescaped-entities': 'off',

    '@typescript-eslint/no-unused-vars': 'off',
    'unused-imports/no-unused-imports': 'warn',
    'unused-imports/no-unused-vars': [
      'warn',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      },
    ],

>>>>>>> main
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
<<<<<<< HEAD
=======

    '@typescript-eslint/consistent-type-imports': [
      'warn',
      {
        prefer: 'type-imports',
        fixStyle: 'separate-type-imports',
        disallowTypeAnnotations: false,
      },
    ],
>>>>>>> main
  },
};
