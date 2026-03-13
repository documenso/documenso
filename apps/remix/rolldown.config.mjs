import babel from '@rolldown/plugin-babel';
import { defineConfig } from 'rolldown';

/**
 * Rolldown config for building the Hono server entry.
 *
 * Replaces the previous rollup.config.mjs. Rolldown provides built-in
 * TypeScript, JSX (automatic runtime), JSON, CJS interop, and node
 * resolution — so we only need a single plugin for lingui macro compilation.
 */
export default defineConfig({
  input: 'server/router.ts',
  output: {
    dir: 'build/server/hono',
    format: 'esm',
    sourcemap: true,
    preserveModules: true,
    preserveModulesRoot: '.',
  },
  // Externalize all third-party deps from node_modules.
  // Workspace packages (@documenso/*) resolve to their actual source paths
  // (outside node_modules) via npm workspace symlinks, so they get bundled.
  external: [/node_modules/],
  platform: 'node',
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    tsconfigFilename: 'tsconfig.json',
  },
  plugins: [
    babel({
      plugins: ['@lingui/babel-plugin-lingui-macro'],
      parserOpts: {
        plugins: ['typescript', 'jsx'],
      },
    }),
  ],
});
