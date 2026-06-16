import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Pin Turbopack's workspace root to the monorepo root so Next.js doesn't warn
// about inferring it from multiple lockfiles ("Detected additional lockfiles").
// The dashboard is a member package, so its root is two levels up.
const monorepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const nextConfig: NextConfig = {
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
