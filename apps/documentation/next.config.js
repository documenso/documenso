/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@documenso/assets',
    '@documenso/lib',
    '@documenso/tailwind-config',
    '@documenso/trpc',
    '@documenso/ui',
  ],
};

const withNextra = require('nextra')({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx',
});

module.exports = withNextra(nextConfig);
