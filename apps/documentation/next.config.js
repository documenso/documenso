import nextra from 'nextra';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@doku-seal/assets',
    '@doku-seal/lib',
    '@doku-seal/tailwind-config',
    '@doku-seal/trpc',
    '@doku-seal/ui',
  ],
};

const withNextra = nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx',
  codeHighlight: true,
});

export default withNextra(nextConfig);
