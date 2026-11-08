
import type { NextConfig } from "next";

const apiOrigin = (
  process.env.FINDEASY_API_ORIGIN ||
  "https://findeasy-api-10137192097.development.catalystappsail.com"
)
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
