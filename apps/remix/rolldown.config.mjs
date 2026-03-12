import { transformAsync } from '@babel/core';
import linguiMacroPlugin from '@lingui/babel-plugin-lingui-macro';
import { defineConfig } from 'rolldown';

const linguiMacroRE = /@lingui\/(core\/macro|react\/macro|macro)/;

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
    {
      name: 'lingui-macro',
      async transform(code, id) {
        if (!/\.(tsx?|jsx?)$/.test(id)) return;
        if (!linguiMacroRE.test(code)) return;

        const result = await transformAsync(code, {
          babelrc: false,
          configFile: false,
          filename: id,
          parserOpts: {
            sourceType: 'module',
            allowAwaitOutsideFunction: true,
            plugins: ['typescript', 'jsx'],
          },
          plugins: [linguiMacroPlugin],
          sourceMaps: true,
        });

        if (!result?.code) return;
        return { code: result.code, map: result.map };
      },
    },
  ],
});
