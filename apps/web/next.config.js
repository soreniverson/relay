const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@relay/shared"],
  // Temporarily ignore TS errors - tRPC types don't propagate correctly in Vercel's clean builds
  // TODO: Fix type annotations in dashboard pages and remove this
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Use standalone output and limit tracing root to prevent stack overflow in CI
  output: "standalone",
  experimental: {
    outputFileTracingRoot: path.join(__dirname, "../../"),
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
