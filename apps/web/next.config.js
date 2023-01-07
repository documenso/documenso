/** @type {import('next').NextConfig} */
require("dotenv").config({ path: "../../.env" });

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  distDir: "build",
};

module.exports = nextConfig;
