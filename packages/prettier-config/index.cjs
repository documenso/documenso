/** @type {import('prettier').Config} */
module.exports = {
  arrowParens: 'always',
  printWidth: 100,
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',

  importOrder: [
    '^server-only|client-only$',
    '^react$',
    '^next(/.*)?$',
    '<THIRD_PARTY_MODULES>',
    '^@documenso/(.*)$',
    '^~/(.*)$',
    '^[./]',
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  // !: Waiting for these to make it upstream
  // importOrderMergeDuplicateImports: true,
  // importOrderCombineTypeAndValueImports: true,

  plugins: [
    '@trivago/prettier-plugin-sort-imports',
    'prettier-plugin-sql',
    'prettier-plugin-tailwindcss',
  ],

  overrides: [
    {
      files: ['*.sql'],
      options: {
        language: 'postgresql',
        keywordCase: 'upper',
        expressionWidth: 60,
      },
    },
  ],
};
