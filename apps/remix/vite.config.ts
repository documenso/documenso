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
  ssr: {
    noExternal: [
      'react-dropzone',
      'recharts',
      'superjson',
      // '@node-rs/bcrypt-wasm32-wasi',
      // '@noble/ciphers/chacha',
      // '@noble/ciphers/utils',
      // '@noble/ciphers/webcrypto/utils',
      // '@noble/hashes/sha256a',
      // '@node-rs/bcrypt',
      // 'crypto',
      // '@documenso/assets',
      // '@documenso/ee',
      // '@documenso/lib',
      // '@documenso/prisma',
      // '@documenso/tailwind-config',
      // '@documenso/trpc',
      // '@documenso/ui',
    ],
  },
  server: {
    port: 3000,
    strictPort: true,
  },
  plugins: [
    reactRouter(),
    lingui(),
    macrosPlugin(),
    serverAdapter({
      entry: 'server/index.ts',
    }),
    tsconfigPaths(),
  ],
  optimizeDeps: {
    exclude: ['superjson'],
    // force: true,
  },
  build: {
    commonjsOptions: {
      include: ['superjson'],
    },
    rollupOptions: {
      external: ['@node-rs/bcrypt'],
    },
  },
});
