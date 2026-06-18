/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["mongodb", "openai", "googleapis"],
  },
};

module.exports = nextConfig;
