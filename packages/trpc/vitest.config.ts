import { lingui } from '@lingui/vite-plugin';
import macrosPlugin from 'vite-plugin-babel-macros';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The drift guard test imports the full `appRouter`, which transitively
  // pulls modules using lingui macros — the same transform pipeline as the
  // app build is required for the import to succeed.
  plugins: [macrosPlugin(), lingui()],
  test: {
    include: ['**/*.test.ts'],
  },
});
