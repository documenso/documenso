import { lingui } from '@lingui/vite-plugin';
import { reactRouter } from '@react-router/dev/vite';
import autoprefixer from 'autoprefixer';
import serverAdapter from 'hono-react-router-adapter/vite';
import path from 'path';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vite';
import macrosPlugin from 'vite-plugin-babel-macros';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  envDir: path.join(__dirname, '../../'),
  envPrefix: 'NEXT_',
  define: {
    'process.env': {},
  },
  css: {
    postcss: {
      plugins: [tailwindcss, autoprefixer],
    },
  },
  ssr: {
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
      entry: 'server/index.ts',
    }),
    tsconfigPaths(),
  ],
  // optimizeDeps: {
  //   exclude: ['@node-rs/bcrypt', '@node-rs/bcrypt-wasm32-wasi', 'react-dropzone', '@documenso/ui'], // Todo: Probably remove.
  //   force: true,
  // },
});
