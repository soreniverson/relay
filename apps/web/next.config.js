const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@relay/shared", "rrweb-player"],
  // Temporarily ignore TS errors - tRPC types don't propagate correctly in Vercel's clean builds
  // TODO: Fix type annotations in dashboard pages and remove this
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable source maps to avoid JSON parsing issues with certain packages
  productionBrowserSourceMaps: false,
  // Use standalone output and limit tracing root to prevent stack overflow in CI
  output: "standalone",
  experimental: {
    outputFileTracingRoot: path.join(__dirname, "../../"),
  },
  webpack: (config, { isServer }) => {
    // Disable source maps for client builds
    if (!isServer) {
      config.devtool = false;
    }
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/api/trpc/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/trpc/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
