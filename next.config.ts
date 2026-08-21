import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
  async redirects() {
    return [
      {
        source: "/r/:path*",
        has: [{ type: "host", value: "gando.pro" }],
        destination: "https://room.gando.pro/r/:path*",
        permanent: true,
      },
      {
        source: "/r/:path*",
        has: [{ type: "host", value: "www.gando.pro" }],
        destination: "https://room.gando.pro/r/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
