/* eslint-disable @typescript-eslint/no-var-requires */
const baseConfig = require('@doku-seal/tailwind-config');
const path = require('path');

module.exports = {
  ...baseConfig,
  content: [
    ...baseConfig.content,
    './app/**/*.{ts,tsx}',
    `${path.join(require.resolve('@doku-seal/ui'), '..')}/components/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@doku-seal/ui'), '..')}/icons/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@doku-seal/ui'), '..')}/lib/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@doku-seal/ui'), '..')}/primitives/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@doku-seal/email'), '..')}/templates/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@doku-seal/email'), '..')}/template-components/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@doku-seal/email'), '..')}/providers/**/*.{ts,tsx}`,
  ],
};
