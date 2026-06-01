/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'http', hostname: 'localhost' },
    ],
    unoptimized: true,
  },
  experimental: {
    serverActions: true,
  },
};

export default nextConfig;