import macrosPlugin from 'vite-plugin-babel-macros';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Transform lingui macros (e.g. `msg`) used by the code under test.
  plugins: [macrosPlugin()],
  test: {
    include: ['**/*.test.ts'],
  },
});
