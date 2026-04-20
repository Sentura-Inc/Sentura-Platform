// Sentura extension vitest configuration.
//
// This file is kept byte-for-byte identical in TWO places:
//
//   1. openclaw/test/vitest/vitest.sentura.config.ts  <-- the LIVE copy vitest loads
//   2. scripts/vitest.sentura.config.ts               <-- a pristine BACKUP in Sentura's tree
//
// Why: the live copy must sit next to OpenClaw's own test infra so the
// `./vitest.shared.config.ts` import is a flat relative path (same convention
// as OpenClaw's `vitest.extension-*.config.ts` files). But `openclaw/` is
// re-pulled periodically, which wipes the live copy — so a pristine backup
// lives under `scripts/` (Sentura's tree, untouched by re-pulls).
//
// After pulling a fresh `openclaw/`, re-place the live copy with:
//
//   cp scripts/vitest.sentura.config.ts openclaw/test/vitest/vitest.sentura.config.ts
//
// Run Sentura extension tests from the `openclaw/` directory so vitest
// resolves from its node_modules:
//
//   cd openclaw && npx vitest run --config test/vitest/vitest.sentura.config.ts
//
// If you edit one copy, edit the other — drift breaks the `cp` workflow.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { sharedVitestConfig } from "./vitest.shared.config.ts";

const thisDir = path.dirname(fileURLToPath(import.meta.url));
// openclaw/test/vitest/ -> openclaw/test/ -> openclaw/ -> <repo> -> <repo>/sentura
const senturaRoot = path.resolve(thisDir, "..", "..", "..", "sentura");

export default defineConfig({
  resolve: sharedVitestConfig.resolve,
  test: {
    root: senturaRoot,
    include: ["extensions/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
