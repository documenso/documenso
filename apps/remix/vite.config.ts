import { lingui } from '@lingui/vite-plugin';
import { reactRouter } from '@react-router/dev/vite';
import autoprefixer from 'autoprefixer';
import serverAdapter from 'hono-react-router-adapter/vite';
import path from 'path';
import tailwindcss from 'tailwindcss';
import { defineConfig, loadEnv } from 'vite';
import macrosPlugin from 'vite-plugin-babel-macros';
import tsconfigPaths from 'vite-tsconfig-paths';

import { getLoadContext } from './server/load-context';

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
    // , 'next/font/google' doesnot work
    noExternal: ['react-dropzone', 'recharts'],
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
      getLoadContext,
      entry: 'server/index.ts',
    }),
    tsconfigPaths(),
  ],
  // optimizeDeps: {
  //   exclude: ['next/font/google'], // Todo: Probably remove.
  //   force: true,
  // },
});
