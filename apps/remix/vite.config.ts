import { defaultOptions as devServerDefaults } from '@hono/vite-dev-server';
import { lingui } from '@lingui/vite-plugin';
import { reactRouter } from '@react-router/dev/vite';
import autoprefixer from 'autoprefixer';
import serverAdapter from 'hono-react-router-adapter/vite';
import { createRequire } from 'node:module';
import path from 'node:path';
import tailwindcss from 'tailwindcss';
import { defineConfig, normalizePath } from 'vite';
import macrosPlugin from 'vite-plugin-babel-macros';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import tsconfigPaths from 'vite-tsconfig-paths';

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
    reactRouter(),
    macrosPlugin(),
    lingui(),
    tsconfigPaths(),
    serverAdapter({
      entry: 'server/router.ts',
      getLoadContext: async () => {
        const { getLoadContext } = await import('./server/load-context');
        return getLoadContext();
      },
      exclude: [
        // Spread the defaults but replace the /.css$/ rule so that Bull
        // Board's static CSS at /api/jobs/board/static/** passes through to Hono.
        ...devServerDefaults.exclude.map((pattern) =>
          pattern instanceof RegExp && pattern.source === '.*\\.css$'
            ? /^(?!\/api\/jobs\/board\/).*\.css$/
            : pattern,
        ),
        '/assets/**',
        '/src/app/**',
        /\?(?:inline|url|no-inline|raw|import(?:&(?:inline|url|no-inline|raw)?)?)$/,
      ],
    }),
  ],
  ssr: {
    noExternal: ['react-dropzone', 'plausible-tracker'],
    external: [
      '@napi-rs/canvas',
      '@node-rs/bcrypt',
      '@prisma/client',
      '@documenso/tailwind-config',
      'playwright',
      'playwright-core',
      '@playwright/browser-chromium',
      'pdfjs-dist',
      '@google-cloud/kms',
      '@google-cloud/secret-manager',
    ],
  },
  optimizeDeps: {
    entries: ['./app/**/*', '../../packages/ui/**/*', '../../packages/lib/**/*'],
    include: ['prop-types', 'file-selector', 'attr-accept'],
    exclude: [
      'node_modules',
      '@napi-rs/canvas',
      '@node-rs/bcrypt',
      'sharp',
      'playwright',
      'playwright-core',
      '@playwright/browser-chromium',
      'lightningcss',
      'fsevents',
    ],
  },
  resolve: {
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
   * Note: Re run rollup again to build the server afterwards.
   *
   * See rollup.config.mjs which is used for that.
   */
  build: {
    rollupOptions: {
      external: [
        '@napi-rs/canvas',
        '@node-rs/bcrypt',
        '@aws-sdk/cloudfront-signer',
        '@google-cloud/kms',
        '@google-cloud/secret-manager',
        'nodemailer',
        /playwright/,
        '@playwright/browser-chromium',
        'skia-canvas',
      ],
    },
  },
});
