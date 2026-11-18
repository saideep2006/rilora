import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  images: { unoptimized: true },
  // A separate build directory lets production builds run while `next dev`
  // is using its own `.next` files (common during local development).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },
};
export default config;
