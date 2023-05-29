require("dotenv").config({ path: "../../.env" });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: false,
  env: {
    IS_PULL_REQUEST: process.env.IS_PULL_REQUEST,
    RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL,
  },
};

const transpileModules = require("next-transpile-modules")([
  "@documenso/prisma",
  "@documenso/lib",
  "@documenso/ui",
  "@documenso/pdf",
  "@documenso/features",
  "@documenso/signing",
  "react-signature-canvas",
]);

const plugins = [
  transpileModules
];

const moduleExports = () => plugins.reduce((acc, next) => next(acc), nextConfig);

module.exports = moduleExports;
