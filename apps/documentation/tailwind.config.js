/* eslint-disable @typescript-eslint/no-var-requires */
const baseConfig = require('@doku-seal/tailwind-config');
const path = require('path');

module.exports = {
  ...baseConfig,
  content: [
    ...baseConfig.content,
    `${path.join(require.resolve('@doku-seal/ui'), '..')}/**/*.{ts,tsx}`,
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    fontFamily: {
      sans: ['Inter', 'sans-serif'],
      serif: ['Caveat', 'cursive'],
    },
  },
};
