/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@labflow/shared'],
  experimental: {
    serverActions: true,
  },
};

module.exports = nextConfig;
