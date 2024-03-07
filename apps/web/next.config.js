/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');
const { version } = require('./package.json');

const ENV_FILES = ['.env', '.env.local', `.env.${process.env.NODE_ENV || 'development'}`];

ENV_FILES.forEach((file) => {
  require('dotenv').config({
    path: path.join(__dirname, `../../${file}`),
  });
});

// !: This is a temp hack to get caveat working without placing it back in the public directory.
// !: By inlining this at build time we should be able to sign faster.
const FONT_CAVEAT_BYTES = fs.readFileSync(
  path.join(__dirname, '../../packages/assets/fonts/caveat.ttf'),
);

/** @type {import('next').NextConfig} */
const config = {
  output: process.env.DOCKER_OUTPUT ? 'standalone' : undefined,
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
    serverComponentsExternalPackages: ['@node-rs/bcrypt'],
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  reactStrictMode: true,
  transpilePackages: [
    '@documenso/assets',
    '@documenso/ee',
    '@documenso/lib',
    '@documenso/prisma',
    '@documenso/tailwind-config',
    '@documenso/trpc',
    '@documenso/ui',
  ],
  env: {
    APP_VERSION: version,
    NEXT_PUBLIC_PROJECT: 'web',
    FONT_CAVEAT_URI: `data:font/ttf;base64,${FONT_CAVEAT_BYTES.toString('base64')}`,
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
  async rewrites() {
    return [
      {
        source: '/ingest/:path*',
        destination: 'https://eu.posthog.com/:path*',
      },
    ];
  },
  async redirects() {
    return [
      {
        permanent: true,
        source: '/documents/:id/sign',
        destination: '/sign/:token',
        has: [
          {
            type: 'query',
            key: 'token',
          },
        ],
      },
      {
        permanent: true,
        source: '/documents/:id/signed',
        destination: '/sign/:token',
        has: [
          {
            type: 'query',
            key: 'token',
          },
        ],
      },
    ];
  },
};

module.exports = config;
