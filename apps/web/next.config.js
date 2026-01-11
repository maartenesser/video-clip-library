/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@video-clip-library/database', '@video-clip-library/storage'],
};

module.exports = nextConfig;
