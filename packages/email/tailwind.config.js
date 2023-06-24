/* eslint-disable @typescript-eslint/no-var-requires */
const baseConfig = require('@documenso/tailwind-config');
const path = require('path');

module.exports = {
  ...baseConfig,
  content: [
    `templates/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@documenso/ui'), '..')}/**/*.{ts,tsx}`,
  ],
};
