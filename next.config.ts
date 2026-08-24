import type { NextConfig } from "next";

const dossierExportAssets = [
  "./public/fonts/**",
  "./public/logos/**",
  "./node_modules/@fontsource/heebo/files/heebo-hebrew-400-normal.woff",
  "./node_modules/@fontsource/heebo/files/heebo-hebrew-700-normal.woff",
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: {
    "/api/students/export": dossierExportAssets,
    "/api/classes/export-dossiers": dossierExportAssets,
  },
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
