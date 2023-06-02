require("dotenv").config({ path: "../../.env" });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },
  transpilePackages: [
    "@documenso/prisma",
    "@documenso/lib",
    "@documenso/ui",
    "@documenso/pdf",
    "@documenso/features",
    "@documenso/signing",
    "react-signature-canvas",
  ],
};

module.exports = nextConfig;
