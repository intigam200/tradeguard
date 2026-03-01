/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["ws", "bufferutil", "utf-8-validate"],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
