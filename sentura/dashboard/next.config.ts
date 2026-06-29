import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dashboardRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dashboardRoot, "../..");

const nextConfig: NextConfig = {
  turbopack: {
    root: repoRoot,
  },
  async redirects() {
    return [
      {
        source: "/client-demos/cross-border/employee",
        destination: "/employee",
        permanent: false,
      },
      {
        source: "/client-demos/cross-border/employee/:path*",
        destination: "/employee/:path*",
        permanent: false,
      },
      {
        source: "/client-demos/cross-border/admin",
        destination: "/admin",
        permanent: false,
      },
      {
        source: "/client-demos/cross-border/admin/:path*",
        destination: "/admin/:path*",
        permanent: false,
      },
      {
        source: "/auth/login",
        destination: "/employee/login",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/employee/login",
        destination: "/auth/login",
      },
      {
        source: "/employee",
        destination: "/client-demos/cross-border/employee",
      },
      {
        source: "/employee/:path*",
        destination: "/client-demos/cross-border/employee/:path*",
      },
      {
        source: "/admin",
        destination: "/client-demos/cross-border/admin",
      },
      {
        source: "/admin/:path*",
        destination: "/client-demos/cross-border/admin/:path*",
      },
      {
        source: "/api/session",
        destination: "/api/client-demos/cross-border/session",
      },
      {
        source: "/api/employee/:path*",
        destination: "/api/client-demos/cross-border/employee/:path*",
      },
      {
        source: "/api/admin/:path*",
        destination: "/api/client-demos/cross-border/admin/:path*",
      },
    ];
  },
};

export default nextConfig;
