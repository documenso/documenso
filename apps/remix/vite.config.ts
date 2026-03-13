import { lingui } from '@lingui/vite-plugin';
import { reactRouter } from '@react-router/dev/vite';
import babel from '@rolldown/plugin-babel';
import autoprefixer from 'autoprefixer';
import serverAdapter from 'hono-react-router-adapter/vite';
import { createRequire } from 'node:module';
import path from 'node:path';
import tailwindcss from 'tailwindcss';
import { defineConfig, normalizePath } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const require = createRequire(import.meta.url);

const pdfjsDistPath = path.dirname(require.resolve('pdfjs-dist/package.json'));
const cMapsDir = normalizePath(path.join(pdfjsDistPath, 'cmaps'));

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
    babel({
      plugins: ['@lingui/babel-plugin-lingui-macro'],
      // @rolldown/plugin-babel's built-in TypeScript parser overrides use
      // `test: "**/*.tsx"` globs which fail to match when React Router appends
      // query strings (e.g. `?__react-router-build-client-route`) to module IDs.
      // Specify parser plugins explicitly so they apply unconditionally.
      parserOpts: {
        plugins: ['typescript', 'jsx'],
      },
    }),
    lingui(),
    reactRouter(),
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
