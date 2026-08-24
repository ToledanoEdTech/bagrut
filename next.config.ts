import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: [
    "@react-pdf/renderer",
    "@react-pdf/font",
    "@react-pdf/layout",
    "@react-pdf/pdfkit",
    "@react-pdf/render",
    "fontkit",
    "jszip",
  ],
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
