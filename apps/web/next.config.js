/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/dashboard",
        permanent: true,
      },
    ];
  },
  reactStrictMode: true,
  swcMinify: true,
  distDir: "build",
};

module.exports = nextConfig;
