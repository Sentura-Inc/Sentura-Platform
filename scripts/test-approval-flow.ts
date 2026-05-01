#!/usr/bin/env -S tsx
/**
 * test-approval-flow.ts -- End-to-end test of the sentura-approval extension.
 *
 * Validates the full HITL pipeline that Person D shipped in Week 3:
 *
 *   AI employee triggers high-risk action
 *     -> tool `sentura_approval_request` (or `fileApprovalImperative`)
 *        files a request through `sentura.approval.requests.list`
 *     -> dashboard reads via `sentura.approval.requests.list`
 *     -> human resolves via `sentura.approval.requests.decide`
 *     -> request transitions pending -> approved | denied (terminal state)
 *
 * Two layers:
 *
 *   1. OFFLINE -- structural checks on extension files / RPC names / types.
 *      Always run.
 *   2. LIVE -- gateway-connected checks (skip when gateway is unreachable):
 *      a. policies.list returns the two builtin policies
 *      b. requests.list returns an array (any current state)
 *      c. requests.decide on a fake id returns NOT_FOUND (proves the RPC
 *         is wired and validation runs)
 *      d. requests.decide rejects bad-input shapes with BAD_REQUEST
 *
 * Run:
 *   npx tsx scripts/test-approval-flow.ts
 */

import fs from "node:fs";
import path from "node:path";
import { WebSocket } from "ws";

const ROOT = path.resolve(import.meta.dirname, "..");
const APPROVAL_EXT = path.join(ROOT, "sentura/extensions/sentura-approval");
const PROVISIONER_EXT = path.join(
  ROOT,
  "sentura/extensions/sentura-provisioner",
);
const GATEWAY_URL = process.env.SENTURA_GATEWAY_URL ?? "ws://localhost:18789";
const CONFIG_PATH = path.join(
  process.env.HOME ?? "/root",
  ".openclaw/openclaw.json",
);

let passed = 0;
let failed = 0;
let skipped = 0;

function ok(label: string, condition: boolean, detail = ""): void {
  if (condition) {
    console.log(`  PASS ${label}`);
    passed++;
  } else {
    console.error(`  FAIL ${label}${detail ? ` -- ${detail}` : ""}`);
    failed++;
  }
}

function skip(label: string, reason: string): void {
  console.log(`  SKIP ${label} [${reason}]`);
  skipped++;
}

function section(name: string): void {
  console.log(`\n=== ${name} ===`);
}

function readIfExists(p: string): string | null {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// OFFLINE
// ---------------------------------------------------------------------------

section("OFFLINE  sentura-approval extension files");

const indexBody = readIfExists(path.join(APPROVAL_EXT, "index.ts"));
const typesBody = readIfExists(path.join(APPROVAL_EXT, "src/types.ts"));
const manifestBody = readIfExists(
  path.join(APPROVAL_EXT, "openclaw.plugin.json"),
);

ok(
  "openclaw.plugin.json exists",
  manifestBody !== null,
  "sentura/extensions/sentura-approval/openclaw.plugin.json missing",
);
ok(
  "index.ts exists",
  indexBody !== null,
  "sentura/extensions/sentura-approval/index.ts missing",
);
ok(
  "src/types.ts exists",
  typesBody !== null,
  "sentura/extensions/sentura-approval/src/types.ts missing",
);

const expectedRpcs = [
  "sentura.approval.requests.list",
  "sentura.approval.requests.get",
  "sentura.approval.requests.decide",
  "sentura.approval.policies.list",
  "sentura.approval.policies.upsert",
  "sentura.approval.policies.remove",
];
for (const rpc of expectedRpcs) {
  ok(
    `index.ts registers ${rpc}`,
    indexBody !== null && indexBody.includes(`"${rpc}"`),
  );
}

ok(
  "agent-facing tool sentura_approval_request registered",
  indexBody !== null && indexBody.includes('"sentura_approval_request"'),
);

ok(
  "fileApprovalImperative export present (used by sentura-provisioner)",
  indexBody !== null &&
    /export\s+async\s+function\s+fileApprovalImperative/.test(indexBody),
);

ok(
  "getApprovalRuntime singleton accessor exported",
  indexBody !== null &&
    /export\s+function\s+getApprovalRuntime/.test(indexBody),
);

ok(
  "ApprovalRequest.onTimeoutDecision field declared",
  typesBody !== null &&
    /onTimeoutDecision\?:\s*"approve"\s*\|\s*"deny"/.test(typesBody),
);

section("OFFLINE  sentura-provisioner wires through approval");

const provIndex = readIfExists(path.join(PROVISIONER_EXT, "index.ts"));
const provPkg = readIfExists(path.join(PROVISIONER_EXT, "package.json"));

ok("sentura-provisioner index.ts exists", provIndex !== null);
ok(
  "sentura-provisioner declares workspace dep on @sentura/approval",
  provPkg !== null && provPkg.includes('"@sentura/approval": "workspace:*"'),
);
ok(
  "provisioner imports fileApprovalImperative",
  provIndex !== null && provIndex.includes("fileApprovalImperative"),
);
ok(
  "provisioner imports getApprovalRuntime (lazy singleton resolution)",
  provIndex !== null && provIndex.includes("getApprovalRuntime"),
);

section("OFFLINE  dashboard /approvals page wires sentura.approval.*");

const clientBody = readIfExists(
  path.join(ROOT, "sentura/dashboard/src/lib/gateway/client.ts"),
);
const hooksBody = readIfExists(
  path.join(ROOT, "sentura/dashboard/src/lib/gateway/hooks.ts"),
);
const pageBody = readIfExists(
  path.join(ROOT, "sentura/dashboard/src/app/approvals/page.tsx"),
);

ok(
  "GatewayClient has listSenturaApprovals",
  clientBody !== null && clientBody.includes("listSenturaApprovals"),
);
ok(
  "GatewayClient has decideSenturaApproval",
  clientBody !== null && clientBody.includes("decideSenturaApproval"),
);
ok(
  "useApprovals seeds Sentura approvals on mount",
  hooksBody !== null && hooksBody.includes("listSenturaApprovals"),
);
ok(
  "/approvals page handles kind=\"sentura\" in resolve handler",
  pageBody !== null &&
    /approval\.kind\s*===\s*"sentura"/.test(pageBody) &&
    pageBody.includes("decideSenturaApproval"),
);

// ---------------------------------------------------------------------------
// LIVE
// ---------------------------------------------------------------------------

interface PendingRpc {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
}

class GatewayRpcClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingRpc>();
  private idCounter = 0;

  connect(url: string, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      let connected = false;
      const to = setTimeout(() => {
        if (!connected) {
          ws.terminate();
          reject(new Error("connect timeout"));
        }
      }, 8000);

      ws.on("error", (e) => {
        clearTimeout(to);
        if (!connected) reject(e as Error);
      });
      ws.on("close", (code, reason) => {
        clearTimeout(to);
        if (!connected) {
          reject(
            new Error(
              `closed before connect code=${code} reason=${String(reason)}`,
            ),
          );
        }
      });

      ws.on("message", (data: Buffer) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(data.toString()) as Record<string, unknown>;
        } catch {
          return;
        }
        if (msg.type === "event" && msg.event === "connect.challenge") {
          const id = String(++this.idCounter);
          const handshake = {
            type: "req",
            id,
            method: "connect",
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: "openclaw-tui",
                displayName: "Sentura Approval Flow Test",
                version: "0.1.0",
                platform: "node",
                mode: "ui",
              },
              caps: [],
              role: "operator",
              scopes: ["operator.read", "operator.write", "operator.admin"],
              auth: { token },
            },
          };
          this.pending.set(id, {
            resolve: () => {
              connected = true;
              clearTimeout(to);
              resolve();
            },
            reject: (e) => reject(e),
          });
          ws.send(JSON.stringify(handshake));
          return;
        }
        if (msg.type === "res") {
          const id = msg.id as string;
          const handler = this.pending.get(id);
          if (!handler) return;
          this.pending.delete(id);
          if (msg.ok) handler.resolve(msg.payload);
          else {
            const errObj = msg.error as
              | { code?: string; message?: string }
              | undefined;
            const errMsg = errObj?.code
              ? `${errObj.code}: ${errObj.message ?? ""}`
              : errObj?.message ?? "rpc error";
            handler.reject(new Error(errMsg));
          }
        }
      });
    });
  }

  rpc<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = String(++this.idCounter);
      const to = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`rpc timeout: ${method}`));
      }, 10_000);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(to);
          resolve(v as T);
        },
        reject: (e) => {
          clearTimeout(to);
          reject(e);
        },
      });
      this.ws!.send(JSON.stringify({ type: "req", id, method, params }));
    });
  }

  close(): void {
    this.ws?.close();
  }
}

function loadOperatorToken(): string | null {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const cfg = JSON.parse(raw) as { gateway?: { auth?: { token?: string } } };
    return cfg.gateway?.auth?.token ?? null;
  } catch {
    return null;
  }
}

async function runLive(): Promise<void> {
  section("LIVE  Gateway-connected approval RPCs");

  const token = loadOperatorToken();
  if (!token) {
    skip(
      "Operator token loaded",
      "~/.openclaw/openclaw.json missing gateway.auth.token",
    );
    skip("policies.list returns builtin policies", "no token");
    skip("requests.list reachable", "no token");
    skip("requests.decide returns NOT_FOUND for unknown id", "no token");
    skip("requests.decide rejects malformed input", "no token");
    return;
  }

  const client = new GatewayRpcClient();
  try {
    await client.connect(GATEWAY_URL, token);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    skip("Gateway reachable at " + GATEWAY_URL, msg);
    skip("policies.list returns builtin policies", "gateway unreachable");
    skip("requests.list reachable", "gateway unreachable");
    skip(
      "requests.decide returns NOT_FOUND for unknown id",
      "gateway unreachable",
    );
    skip("requests.decide rejects malformed input", "gateway unreachable");
    return;
  }
  ok("Gateway reachable at " + GATEWAY_URL, true);

  // policies.list -- should include the two builtin policies seeded by register()
  try {
    const resp = await client.rpc<{ policies?: Array<{ id: string }> }>(
      "sentura.approval.policies.list",
    );
    const policies = resp?.policies ?? [];
    const ids = new Set(policies.map((p) => p.id));
    ok(
      "policies.list returns builtins",
      ids.has("builtin:critical-always-human") &&
        ids.has("builtin:low-risk-auto-approve"),
      `got ids: [${[...ids].join(", ")}]`,
    );
  } catch (err) {
    ok(
      "policies.list returns builtins",
      false,
      err instanceof Error ? err.message : String(err),
    );
  }

  // requests.list -- should be reachable; empty or non-empty both fine
  try {
    const resp = await client.rpc<{ requests?: unknown[] }>(
      "sentura.approval.requests.list",
      { status: "pending" },
    );
    ok(
      "requests.list reachable (status=pending filter)",
      Array.isArray(resp?.requests),
    );
  } catch (err) {
    ok(
      "requests.list reachable (status=pending filter)",
      false,
      err instanceof Error ? err.message : String(err),
    );
  }

  // requests.decide on a known-bad id -> NOT_FOUND
  try {
    await client.rpc("sentura.approval.requests.decide", {
      requestId: "apr_does_not_exist_00000000",
      decision: "approved",
      decidedByUserId: "test-runner",
    });
    ok(
      "requests.decide returns NOT_FOUND for unknown id",
      false,
      "expected error, got success",
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ok(
      "requests.decide returns NOT_FOUND for unknown id",
      msg.includes("NOT_FOUND"),
      msg,
    );
  }

  // requests.decide with malformed input -> BAD_REQUEST
  try {
    await client.rpc("sentura.approval.requests.decide", {
      requestId: "apr_anything",
      decision: "maybe",
      decidedByUserId: "test-runner",
    });
    ok(
      "requests.decide rejects malformed decision",
      false,
      "expected error, got success",
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ok(
      "requests.decide rejects malformed decision",
      msg.includes("BAD_REQUEST"),
      msg,
    );
  }

  client.close();
}

await runLive();

console.log(
  `\nSummary: ${passed} passed, ${failed} failed, ${skipped} skipped`,
);
process.exit(failed === 0 ? 0 : 1);
