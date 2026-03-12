import { transformAsync } from '@babel/core';
import linguiMacroPlugin from '@lingui/babel-plugin-lingui-macro';
import { lingui } from '@lingui/vite-plugin';
import { reactRouter } from '@react-router/dev/vite';
import autoprefixer from 'autoprefixer';
import serverAdapter from 'hono-react-router-adapter/vite';
import { createRequire } from 'node:module';
import path from 'node:path';
import tailwindcss from 'tailwindcss';
import { defineConfig, normalizePath } from 'vite';
import type { Plugin } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const require = createRequire(import.meta.url);

const pdfjsDistPath = path.dirname(require.resolve('pdfjs-dist/package.json'));
const cMapsDir = normalizePath(path.join(pdfjsDistPath, 'cmaps'));

/**
 * Targeted Lingui macro compilation plugin.
 *
 * Replaces the generic `vite-plugin-babel-macros` which ran a full Babel
 * parse + transform on every single .ts/.tsx file. This plugin:
 *
 * 1. Skips files that don't contain lingui macro imports (fast string check).
 * 2. Uses `@lingui/babel-plugin-lingui-macro` directly instead of going
 *    through the generic `babel-plugin-macros` wrapper.
 */
const linguiMacroRE = /@lingui\/(core\/macro|react\/macro|macro)/;

function linguiMacro(): Plugin {
  return {
    name: 'vite-plugin-lingui-macro',
    enforce: 'pre',
    async transform(code, id) {
      if (id.includes('/node_modules/')) return;

      const [filepath] = id.split('?');
      if (!/\.(tsx?|jsx?)$/.test(filepath)) return;

      // Fast bail-out: skip files that don't reference lingui macros.
      if (!linguiMacroRE.test(code)) return;

      const result = await transformAsync(code, {
        babelrc: false,
        configFile: false,
        filename: id,
        sourceFileName: filepath,
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
  };
}

/**
 * Note: We load the env variables externally so we can have runtime enviroment variables
 * for docker.
 *
 * Do not configure any envs here.
 */
export default defineConfig({
  css: {
    postcss: {
      plugins: [tailwindcss, autoprefixer],
    },
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    strictPort: true,
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: cMapsDir,
          dest: 'static',
        },
      ],
    }),
    reactRouter(),
    linguiMacro(),
    // lingui() returns two plugins: a macro error reporter and the .po catalog
    // compiler. The error reporter adds a resolveId hook on every module to
    // detect uncompiled macros — redundant since linguiMacro() already compiles
    // them, and it was consuming 51% of plugin time in the build.
    ...lingui().filter((p) => 'name' in p && p.name !== 'vite-plugin-lingui-report-macro-error'),
    serverAdapter({
      entry: 'server/router.ts',
    }),
  ],
  ssr: {
    noExternal: ['react-dropzone'],
    external: [
      '@napi-rs/canvas',
      '@node-rs/bcrypt',
      '@prisma/client',
      '@documenso/tailwind-config',
      'playwright',
      'playwright-core',
      '@playwright/browser-chromium',
      'pdfjs-dist',
    ],
  },
  optimizeDeps: {
    // Only scan the app directory — workspace packages (ui, lib) are
    // discovered transitively through app imports. The previous config
    // scanned ~1,000 files including server-only code from packages/lib.
    entries: ['./app/**/*'],
    include: ['prop-types', 'file-selector', 'attr-accept'],
    exclude: [
      '@napi-rs/canvas',
      '@node-rs/bcrypt',
      'sharp',
      'playwright',
      'playwright-core',
      '@playwright/browser-chromium',
    ],
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      https: 'node:https',
      '.prisma/client/default': path.resolve(
        __dirname,
        '../../node_modules/.prisma/client/default.js',
      ),
      '.prisma/client/index-browser': path.resolve(
        __dirname,
        '../../node_modules/.prisma/client/index-browser.js',
      ),
      canvas: path.resolve(__dirname, './app/types/empty-module.ts'),
    },
  },
  /**
   * Note: Re run rolldown again to build the server afterwards.
   *
   * See rolldown.config.mjs which is used for that.
   */
  build: {
    // LightningCSS (Vite 8 default) is stricter and rejects nested @page
    // rules and some Tailwind theme() edge cases. Use esbuild for CSS
    // minification until LightningCSS support matures or the CSS is updated.
    cssMinify: 'esbuild',
    rollupOptions: {
      external: [
        '@napi-rs/canvas',
        '@node-rs/bcrypt',
        '@aws-sdk/cloudfront-signer',
        'nodemailer',
        /playwright/,
        '@playwright/browser-chromium',
        'skia-canvas',
      ],
    },
  },
});
