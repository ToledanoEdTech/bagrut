import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  async redirects() {
    return [
      {
        source: "/admin/grades/overview",
        destination: "/admin/grades-matrix",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
