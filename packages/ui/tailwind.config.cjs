/* eslint-disable @typescript-eslint/no-var-requires */
const baseConfig = require('@documenso/tailwind-config');
const { RECIPIENT_DYNAMIC_CLASS } = require('./lib/recipient-colors');

module.exports = {
  presets: [baseConfig],
  content: [
    ...baseConfig.content,
    './primitives/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  safelist: [RECIPIENT_DYNAMIC_CLASS],
};
