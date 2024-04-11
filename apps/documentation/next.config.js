/** @type {import('next').NextConfig} */
const nextConfig = {};

const withNextra = require('nextra')({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.jsx',
});

module.exports = withNextra(nextConfig);
