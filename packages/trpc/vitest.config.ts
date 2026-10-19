import { lingui } from '@lingui/vite-plugin';
import macrosPlugin from 'vite-plugin-babel-macros';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The drift guard test imports the full `appRouter`, which transitively pulls
  // in lingui macros.
  plugins: [macrosPlugin(), lingui()],
  test: {
    include: ['**/*.test.ts'],
  },
});
