import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { sharedVitestConfig } from "../openclaw/vitest.shared.config.ts";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const senturaRoot = path.resolve(repoRoot, "..", "sentura");

export default defineConfig({
  resolve: sharedVitestConfig.resolve,
  test: {
    root: senturaRoot,
    include: ["extensions/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
