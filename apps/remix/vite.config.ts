import { lingui } from '@lingui/vite-plugin';
import { reactRouter } from '@react-router/dev/vite';
import autoprefixer from 'autoprefixer';
import serverAdapter from 'hono-react-router-adapter/vite';
import path from 'node:path';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vite';
import macrosPlugin from 'vite-plugin-babel-macros';
import tsconfigPaths from 'vite-tsconfig-paths';

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
    port: 3000,
    strictPort: true,
  },
  plugins: [
    reactRouter(),
    macrosPlugin(),
    lingui(),
    tsconfigPaths(),
    serverAdapter({
      entry: 'server/router.ts',
    }),
  ],
  ssr: {
    noExternal: ['react-dropzone', 'plausible-tracker', 'pdfjs-dist'],
    external: ['@node-rs/bcrypt', '@prisma/client', '@documenso/tailwind-config'],
  },
  optimizeDeps: {
    entries: ['./app/**/*', '../../packages/ui/**/*', '../../packages/lib/**/*'],
    include: ['prop-types', 'file-selector', 'attr-accept'],
    exclude: ['node_modules', '@node-rs/bcrypt', '@documenso/pdf-sign', 'sharp'],
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
        '@node-rs/bcrypt',
        '@documenso/pdf-sign',
        '@aws-sdk/cloudfront-signer',
        'nodemailer',
        'playwright',
      ],
    },
  },
});
