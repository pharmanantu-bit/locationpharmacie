import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: {
      // Ordonnances jointes aux dossiers (PDF ou photo, 8 Mo max + en-têtes multipart)
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
