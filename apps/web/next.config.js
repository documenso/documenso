/** @type {import('next').NextConfig} */
require("dotenv").config({ path: "../../.env" });

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  distDir: "build",
};

const withTM = require("next-transpile-modules")(["@documenso/prisma"]);
const plugins = [];
plugins.push(withTM);

const moduleExports = () =>
  plugins.reduce((acc, next) => next(acc), nextConfig);

module.exports = moduleExports;
