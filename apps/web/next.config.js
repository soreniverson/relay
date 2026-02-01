/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Removed transpilePackages to test
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  productionBrowserSourceMaps: false,
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
