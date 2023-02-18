/** @type {import('next').NextConfig} */
require("dotenv").config({ path: "../../.env" });

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
};

const withTM = require("next-transpile-modules")([
  "@documenso/prisma",
  "@documenso/lib",
  "@documenso/ui",
  "@documenso/pdf",
  "@documenso/features",
  "react-signature-canvas",
]);
const plugins = [];
plugins.push(withTM);

const moduleExports = () =>
  plugins.reduce((acc, next) => next(acc), nextConfig);

module.exports = moduleExports;
