/* eslint-disable @typescript-eslint/no-var-requires */
const baseConfig = require('@documenso/tailwind-config');

// Recipient dynamic classes are safelisted via `@source inline(...)` in theme.css (v4 ignores JS `safelist`).
module.exports = {
  presets: [baseConfig],
  content: [...baseConfig.content, './primitives/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
};
