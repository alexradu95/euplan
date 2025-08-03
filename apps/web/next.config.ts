import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack: (config: { resolve: { fallback: Record<string, boolean | string> } }, { isServer }: { isServer: boolean }) => {
    // Don't resolve 'fs' module on the client side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;