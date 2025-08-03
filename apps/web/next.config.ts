import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Optimize bundle
  experimental: {
    optimizePackageImports: ['lucide-react', '@tiptap/react'],
  },
  
  // Compress responses
  compress: true,
  
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  
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
  
  // Bundle analyzer (uncomment to analyze)
  // webpack: (config, { dev, isServer }) => {
  //   if (!dev && !isServer) {
  //     const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
  //     config.plugins.push(
  //       new BundleAnalyzerPlugin({
  //         analyzerMode: 'static',
  //         openAnalyzer: false,
  //       })
  //     )
  //   }
  //   return config
  // },
};

export default nextConfig;