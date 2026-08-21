import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
  async redirects() {
    return [
      { source: "/:path*", has: [{ type: "host", value: "gando.pro" }], destination: "https://room.gando.pro/:path*", permanent: true },
      { source: "/:path*", has: [{ type: "host", value: "www.gando.pro" }], destination: "https://room.gando.pro/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
