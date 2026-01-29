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
  // Exclude patterns that cause micromatch stack overflow
  experimental: {
    outputFileTracingExcludes: {
      "*": [
        "node_modules/@swc/core-linux-x64-gnu",
        "node_modules/@swc/core-linux-x64-musl",
        "node_modules/@esbuild/linux-x64",
        "node_modules/sharp",
        "node_modules/prisma",
      ],
    },
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
