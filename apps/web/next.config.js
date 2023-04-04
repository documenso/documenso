/** @type {import('next').NextConfig} */
require("dotenv").config({ path: "../../.env" });

const nextConfig = {
  reactStrictMode: true,
  swcMinify: false,
};

const withTM = require("next-transpile-modules")([
  "@documenso/prisma",
  "@documenso/lib",
  "@documenso/ui",
  "@documenso/pdf",
  "@documenso/features",
  "@documenso/signing",
  "react-signature-canvas",
]);
const plugins = [];
plugins.push(withTM);

const moduleExports = () => plugins.reduce((acc, next) => next(acc), nextConfig);

module.exports = moduleExports;
