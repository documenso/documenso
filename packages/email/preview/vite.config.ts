import path from 'node:path';
import { lingui } from '@lingui/vite-plugin';
import { reactRouter } from '@react-router/dev/vite';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vite';
import macrosPlugin from 'vite-plugin-babel-macros';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Standalone Vite app for previewing Documenso emails.
 *
 * Emails render server-side through the real `renderEmailWithI18N` pipeline
 * (see `app/routes/preview.tsx`), so the SSR config mirrors the main Remix app:
 * Prisma, the tailwind config, and native modules stay external.
 */
export default defineConfig({
  root: __dirname,
  css: {
    postcss: {
      plugins: [tailwindcss(path.join(__dirname, 'tailwind.config.cjs')), autoprefixer],
    },
  },
  server: {
    port: parseInt(process.env.PORT || '3002', 10),
    strictPort: true,
  },
  plugins: [
    // Serve the email static assets (logo, icons) under `/static` so templates'
    // `assetBaseUrl="/static"` resolves to the same images production uses.
    viteStaticCopy({
      targets: [
        {
          src: path.join(__dirname, '../static') + '/*',
          dest: 'static',
        },
      ],
    }),
    reactRouter(),
    macrosPlugin(),
    lingui(),
    tsconfigPaths(),
  ],
  ssr: {
    noExternal: ['@documenso/email'],
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
    exclude: [
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
});
