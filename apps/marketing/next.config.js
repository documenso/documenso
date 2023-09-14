/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const { withContentlayer } = require('next-contentlayer');
const { remapVercelEnv } = require('../../scripts/remap-vercel-env.cjs');

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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'x-dns-prefetch-control',
            value: 'on',
          },
          {
            key: 'strict-transport-security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'x-frame-options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'x-content-type-options',
            value: 'nosniff',
          },
          {
            key: 'referrer-policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'permissions-policy',
            value:
              'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
          },
        ],
      },
    ];
  },
};

module.exports = withContentlayer(config);
