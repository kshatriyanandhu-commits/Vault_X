import type { NextConfig } from 'next';

const BACKEND_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  skipTrailingSlashRedirect: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  async rewrites() {
    // If a remote or hosted Django backend URL is set in Vercel environment variables:
    if (BACKEND_URL) {
      return [
        {
          source: '/api/:path*',
          destination: `${BACKEND_URL.replace(/\/+$/, '')}/api/:path*`,
        },
      ];
    }
    // In local development, proxy to local Django server on port 8000
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://127.0.0.1:8000/api/:path*',
        },
      ];
    }
    // In Vercel production without a BACKEND_API_URL set, Next.js App Router API handlers in src/app/api/... serve the requests
    return [];
  },
};

export default nextConfig;
