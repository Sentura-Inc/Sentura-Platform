#!/usr/bin/env tsx
/**
 * Week 4 Task 6 — OpenTelemetry wiring tests.
 *
 * Verifies the Step 7c node-patcher logic from `scripts/sentura-setup.sh`
 * by replaying it against a temp `openclaw.json` fixture. The Step 7c
 * block is inlined inside the bash script (one-shot `node -e`), so we
 * re-implement the exact same logic here against synthetic configs and
 * assert idempotency, env-var override semantics, and the "endpoint
 * unset → no-op" path.
 *
 * Usage:  npx tsx scripts/test-week4-otel.ts
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let pass = 0;
let fail = 0;

function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  ✓ ${name}`);
    pass++;
  } else {
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
    fail++;
  }
}

interface OtelConfig {
  enabled?: boolean;
  endpoint?: string;
  serviceName?: string;
}

interface DiagnosticsConfig {
  enabled?: boolean;
  otel?: OtelConfig;
}

interface OpenClawConfigShape {
  diagnostics?: DiagnosticsConfig;
  plugins?: {
    entries?: Record<string, { enabled?: boolean }>;
  };
}

/**
 * Mirrors the Step 7c node-patcher from `scripts/sentura-setup.sh`. Returns
 * the new config plus a flag indicating whether anything changed (used by
 * the bash script to skip the file write on a no-op re-run).
 */
function applyOtelStep7c(
  cfg: OpenClawConfigShape,
  endpoint: string | undefined,
  serviceName: string,
): { cfg: OpenClawConfigShape; changed: boolean } {
  if (!endpoint) {
    return { cfg, changed: false };
  }

  if (!cfg.plugins) cfg.plugins = {};
  if (!cfg.plugins.entries) cfg.plugins.entries = {};

  let changed = false;
  const current = cfg.plugins.entries["diagnostics-otel"] ?? {};
  if (current.enabled !== true) {
    cfg.plugins.entries["diagnostics-otel"] = { ...current, enabled: true };
    changed = true;
  }

  if (!cfg.diagnostics) cfg.diagnostics = {};
  if (cfg.diagnostics.enabled !== true) {
    cfg.diagnostics.enabled = true;
    changed = true;
  }
  const otelBlock = cfg.diagnostics.otel ?? {};
  const desiredService = otelBlock.serviceName ?? serviceName;
  if (
    otelBlock.enabled !== true ||
    otelBlock.endpoint !== endpoint ||
    (otelBlock.serviceName ?? "") !== desiredService
  ) {
    cfg.diagnostics.otel = {
      ...otelBlock,
      enabled: true,
      endpoint,
      serviceName: desiredService,
    };
    changed = true;
  }
  return { cfg, changed };
}

function testEnabledFromEnvVar(): void {
  console.log("\n[1] OTEL_EXPORTER_OTLP_ENDPOINT set → enables diagnostics-otel");
  const cfg: OpenClawConfigShape = {};
  const { cfg: out, changed } = applyOtelStep7c(cfg, "http://localhost:4318", "openclaw-sentura");

  check("changed flag is true on first run", changed === true);
  check(
    "plugins.entries['diagnostics-otel'].enabled = true",
    out.plugins?.entries?.["diagnostics-otel"]?.enabled === true,
  );
  check("diagnostics.enabled = true", out.diagnostics?.enabled === true);
  check("diagnostics.otel.enabled = true", out.diagnostics?.otel?.enabled === true);
  check(
    "diagnostics.otel.endpoint matches env var",
    out.diagnostics?.otel?.endpoint === "http://localhost:4318",
  );
  check(
    "diagnostics.otel.serviceName defaults to 'openclaw-sentura'",
    out.diagnostics?.otel?.serviceName === "openclaw-sentura",
  );
}

function testEndpointUnsetIsNoOp(): void {
  console.log("\n[2] OTEL_EXPORTER_OTLP_ENDPOINT unset → no-op");
  const cfg: OpenClawConfigShape = {};
  const { cfg: out, changed } = applyOtelStep7c(cfg, undefined, "openclaw-sentura");
  check("changed flag is false", changed === false);
  check(
    "diagnostics.otel left untouched (no plugin entry created)",
    out.plugins?.entries?.["diagnostics-otel"] === undefined,
  );
  check("diagnostics block left untouched", out.diagnostics === undefined);
}

function testIdempotent(): void {
  console.log("\n[3] Idempotent re-run with same endpoint");
  const initial: OpenClawConfigShape = {};
  const first = applyOtelStep7c(initial, "http://collector.local:4318", "openclaw-sentura");
  check("first run sets changed=true", first.changed === true);
  const second = applyOtelStep7c(first.cfg, "http://collector.local:4318", "openclaw-sentura");
  check("second run sets changed=false (no diff)", second.changed === false);
}

function testEndpointChangeUpdates(): void {
  console.log("\n[4] Endpoint change re-stamps the config");
  const initial: OpenClawConfigShape = {};
  const first = applyOtelStep7c(initial, "http://localhost:4318", "openclaw-sentura");
  const second = applyOtelStep7c(first.cfg, "http://prod-collector:4318", "openclaw-sentura");
  check("changed flag flips back to true", second.changed === true);
  check(
    "endpoint updated to new value",
    second.cfg.diagnostics?.otel?.endpoint === "http://prod-collector:4318",
  );
}

function testCustomServiceNamePreserved(): void {
  console.log("\n[5] Operator-customized serviceName is preserved on re-run");
  const initial: OpenClawConfigShape = {
    diagnostics: {
      enabled: true,
      otel: {
        enabled: true,
        endpoint: "http://localhost:4318",
        serviceName: "my-custom-name",
      },
    },
    plugins: { entries: { "diagnostics-otel": { enabled: true } } },
  };
  const result = applyOtelStep7c(initial, "http://localhost:4318", "openclaw-sentura");
  check(
    "operator's serviceName survives the re-run",
    result.cfg.diagnostics?.otel?.serviceName === "my-custom-name",
  );
  check("changed flag is false (no diff)", result.changed === false);
}

function testDocsExampleCompose(): void {
  console.log("\n[6] docs/otel/docker-compose.example.yml is present and parseable");
  const composePath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    "..",
    "docs",
    "otel",
    "docker-compose.example.yml",
  );
  void (async () => {
    try {
      const content = await fs.readFile(composePath, "utf-8");
      check("file exists", content.length > 0);
      check(
        "documents OTEL_EXPORTER_OTLP_ENDPOINT",
        content.includes("OTEL_EXPORTER_OTLP_ENDPOINT"),
      );
      check("ports 4318 (OTLP HTTP) declared", content.includes("4318"));
      check("Jaeger UI 16686 declared", content.includes("16686"));
    } catch (err) {
      check("file exists", false, String(err));
    }
  })();
}

async function main(): Promise<void> {
  console.log("Week 4 Task 6 — OpenTelemetry wiring tests");

  testEnabledFromEnvVar();
  testEndpointUnsetIsNoOp();
  testIdempotent();
  testEndpointChangeUpdates();
  testCustomServiceNamePreserved();
  testDocsExampleCompose();

  // Allow async test in [6] to settle.
  await new Promise((r) => setTimeout(r, 100));

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});

// Suppress lint warning for unused os import; kept for symmetry with sibling tests.
void os;
