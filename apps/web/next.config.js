/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const { version } = require('./package.json');

const { parsed: env } = require('dotenv').config({
  path: path.join(__dirname, '../../.env.local'),
});

/** @type {import('next').NextConfig} */
const config = {
  experimental: {
    serverActions: true,
    serverActionsBodySizeLimit: '50mb',
  },
  reactStrictMode: true,
  transpilePackages: [
    '@documenso/lib',
    '@documenso/prisma',
    '@documenso/trpc',
    '@documenso/ui',
    '@documenso/email',
  ],
  env: {
    APP_VERSION: version,
  },
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{ kebabCase member }}',
    },
  },
};

module.exports = config;
