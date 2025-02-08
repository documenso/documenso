import { lingui } from '@lingui/vite-plugin';
import { reactRouter } from '@react-router/dev/vite';
import autoprefixer from 'autoprefixer';
import serverAdapter from 'hono-react-router-adapter/vite';
import path from 'path';
import tailwindcss from 'tailwindcss';
import { defineConfig, loadEnv } from 'vite';
import macrosPlugin from 'vite-plugin-babel-macros';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  envDir: path.join(__dirname, '../../'),
  envPrefix: '__DO_NOT_USE_OR_YOU_WILL_BE_FIRED__',
  define: {
    'process.env': {
      ...process.env,
      ...loadEnv('development', path.join(__dirname, '../../'), ''),
    },
  },
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
    external: ['@node-rs/bcrypt', '@prisma/client'],
  },
  optimizeDeps: {
    entries: ['./app/**/*', '../../packages/ui/**/*', '../../packages/lib/**/*'],
    include: ['prop-types', 'file-selector', 'attr-accept'],
    exclude: ['node_modules', '@node-rs/bcrypt', '@documenso/pdf-sign', 'sharp'],
  },
  resolve: {
    alias: {
      https: 'node:https',
      '.prisma/client/default': '../../node_modules/.prisma/client/default.js',
      '.prisma/client/index-browser': '../../node_modules/.prisma/client/index-browser.js',
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
