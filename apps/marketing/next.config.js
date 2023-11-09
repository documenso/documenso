/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const { withContentlayer } = require('next-contentlayer');

const ENV_FILES = ['.env', '.env.local', `.env.${process.env.NODE_ENV || 'development'}`];

ENV_FILES.forEach((file) => {
  require('dotenv').config({
    path: path.join(__dirname, `../../${file}`),
  });
});

/** @type {import('next').NextConfig} */
const config = {
  experimental: {
    serverActionsBodySizeLimit: '10mb',
  },
  reactStrictMode: true,
  transpilePackages: ['@documenso/lib', '@documenso/prisma', '@documenso/trpc', '@documenso/ui'],
  env: {
    NEXT_PUBLIC_PROJECT: 'marketing',
  },
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{ kebabCase member }}',
    },
  },
  webpack: (config, { isServer }) => {
    // fixes: Module not found: Can’t resolve ‘../build/Release/canvas.node’
    if (isServer) {
      config.resolve.alias.canvas = false;
    }

    return config;
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
  async rewrites() {
    return [
      {
        source: '/ingest/:path*',
        destination: 'https://eu.posthog.com/:path*',
      },
    ];
  },
};

module.exports = withContentlayer(config);
