/* eslint-disable @typescript-eslint/no-var-requires */
const baseConfig = require('@doku-seal/tailwind-config');
const path = require('path');

module.exports = {
  ...baseConfig,
  content: [`templates/**/*.{ts,tsx}`],
};
