/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const { withContentlayer } = require('next-contentlayer');

const { parsed: env } = require('dotenv').config({
  path: path.join(__dirname, '../../.env.local'),
});

/** @type {import('next').NextConfig} */
const config = {
  experimental: {
    serverActions: true,
  },
  reactStrictMode: true,
  transpilePackages: ['@documenso/lib', '@documenso/prisma', '@documenso/trpc', '@documenso/ui'],
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{ kebabCase member }}',
    },
  },
};

module.exports = withContentlayer(config);
