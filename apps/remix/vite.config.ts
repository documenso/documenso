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
      entry: 'server/index.ts',
    }),
  ],
  ssr: {
    noExternal: ['react-dropzone', 'plausible-tracker', 'pdfjs-dist'],
    external: ['@node-rs/bcrypt'],
  },
  optimizeDeps: {
    exclude: ['@node-rs/bcrypt'],
  },
  /**
   * Throwing shit at a wall to see what sticks for building below onwards.
   */
  // resolve: {
  //   alias: {
  //     // https: 'node:https',
  //     // '.prisma/client/default': '../../node_modules/.prisma/client/default.js',
  //   },
  // },
  // optimizeDeps: {
  //   include: [],
  // },
  // ssr: {
  //   // noExternal: true,
  //   noExternal: [
  //     '@documenso/assets',
  //     '@documenso/ee',
  //     '@documenso/lib',
  //     '@documenso/prisma',
  //     '@documenso/tailwind-config',
  //     '@documenso/trpc',
  //     '@documenso/ui',
  //   ],
  // },
  // build: {
  //   rollupOptions: {
  //     external: [
  //       '@node-rs/bcrypt',
  //       '@documenso/pdf-sign',
  //       'nodemailer',
  //       'playwright',
  //       '@aws-sdk/cloudfront-signer',
  //     ],
  //   },
  // },
});
