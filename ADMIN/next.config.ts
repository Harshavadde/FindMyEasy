import type { NextConfig } from "next";

const apiOrigin = (process.env.FINDEASY_API_ORIGIN || "http://127.0.0.1:8000")
  .trim()
  .replace(/\/+$/, "");

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${apiOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
