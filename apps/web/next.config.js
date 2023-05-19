const path = require("path");

require("dotenv").config({ path: "../../.env" });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: path.join(__dirname, "../../"),
    transpilePackages: [
      "@documenso/prisma",
      "@documenso/lib",
      "@documenso/ui",
      "@documenso/pdf",
      "@documenso/features",
      "@documenso/signing",
      "react-signature-canvas",
    ]
  }
};


module.exports = nextConfig;
