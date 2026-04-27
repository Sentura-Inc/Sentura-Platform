/**
 * Week 3 — Auto-handshake helper offline test (A21).
 *
 * Verifies that `triggerAutoHandshake` composes the right prompt, passes the
 * correct args to `GatewayClient.createChatSession`, and respects the
 * `enabled: false` toggle. Uses an in-memory stub for `createChatSession` so
 * no live gateway is needed.
 *
 * Run: npx tsx scripts/test-creator-handshake.ts
 */

// Dashboard is a CommonJS package (no "type":"module") and the root is ESM.
// tsx wraps the dashboard's named exports under a `default` namespace at the
// CJS/ESM interop boundary, so we have to namespace-import and reach in.
import * as autoHandshakeModule from "../sentura/dashboard/src/lib/auto-handshake.ts";
import type { GatewayClient } from "../sentura/dashboard/src/lib/gateway/client.ts";

type AutoHandshakeAPI = typeof import("../sentura/dashboard/src/lib/auto-handshake.ts");

const ahNamespace = autoHandshakeModule as unknown as { default?: AutoHandshakeAPI } & AutoHandshakeAPI;
const ah: AutoHandshakeAPI =
  (ahNamespace.default && typeof ahNamespace.default.composeHandshakePrompt === "function"
    ? ahNamespace.default
    : ahNamespace);

const { composeHandshakeLabel, composeHandshakePrompt, triggerAutoHandshake } = ah;

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
    passed += 1;
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`);
    failed += 1;
  }
}

function section(title: string) {
  console.log(`\n\x1b[1m━━━ ${title} ━━━\x1b[0m`);
}

interface RecordedCall {
  agentId: string;
  initialMessage?: string;
  label?: string;
}

function makeStubClient(returnKey: string): {
  client: GatewayClient;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const client = {
    createChatSession: async (
      agentId: string,
      options?: { initialMessage?: string; label?: string },
    ) => {
      calls.push({
        agentId,
        initialMessage: options?.initialMessage,
        label: options?.label,
      });
      return { ok: true, key: returnKey };
    },
  } as unknown as GatewayClient;
  return { client, calls };
}

async function main() {
  section("A21.1 Prompt composition");
  const promptWithName = composeHandshakePrompt({
    newAgentName: "Billing Support Rep",
    operatorName: "Henry Zhang",
  });
  check(
    "addresses operator by name",
    promptWithName.includes("Henry Zhang"),
  );
  check(
    "names the new employee",
    promptWithName.includes("Billing Support Rep"),
  );
  check(
    "covers all 5 required points (name/role, sample tasks, escalation, integrations, contact)",
    promptWithName.includes("Who I am")
      && promptWithName.includes("What I can do today")
      && promptWithName.includes("Where I escalate")
      && promptWithName.includes("What I am wired into")
      && promptWithName.includes("How to reach me"),
  );
  check(
    "instructs employee to ground claims in its own workspace files",
    promptWithName.includes("SOUL.md")
      && promptWithName.includes("AGENTS.md")
      && promptWithName.includes("Hard Rules"),
  );
  check(
    "enforces T0/T1 only (no secrets / no PII echo)",
    promptWithName.includes("T0/T1") && promptWithName.includes("secrets"),
  );

  const promptFallback = composeHandshakePrompt({
    newAgentName: null,
    operatorName: null,
  });
  check(
    "falls back to 'Operator' when name is missing",
    promptFallback.includes("Operator"),
  );
  check(
    "falls back to 'your new AI employee' when agent name is missing",
    promptFallback.includes("your new AI employee"),
  );

  section("A21.2 Label composition");
  check(
    "label uses agent display name",
    composeHandshakeLabel("Billing Support Rep", "billing-support-rep")
      === "Welcome from Billing Support Rep",
  );
  check(
    "label falls back to agent id",
    composeHandshakeLabel(null, "billing-support-rep")
      === "Welcome from billing-support-rep",
  );
  check(
    "label final fallback when both missing",
    composeHandshakeLabel(null, null) === "Welcome from new employee",
  );

  section("A21.3 triggerAutoHandshake — happy path");
  const { client: c1, calls: calls1 } = makeStubClient(
    "agent:billing-support-rep:dashboard:abc-123",
  );
  const r1 = await triggerAutoHandshake({
    client: c1,
    newAgentId: "billing-support-rep",
    newAgentName: "Billing Support Rep",
    operator: { name: "Henry Zhang", email: "info@sentura.ai" },
  });
  check(
    "returns sessionKey from createChatSession",
    r1?.sessionKey === "agent:billing-support-rep:dashboard:abc-123",
  );
  check(
    "returns the prompt that was sent",
    typeof r1?.handshakePrompt === "string"
      && (r1?.handshakePrompt ?? "").includes("Henry Zhang"),
  );
  check(
    "calls createChatSession exactly once with correct agentId",
    calls1.length === 1 && calls1[0].agentId === "billing-support-rep",
  );
  check(
    "passes initialMessage with operator name",
    typeof calls1[0].initialMessage === "string"
      && calls1[0].initialMessage!.includes("Henry Zhang"),
  );
  check(
    "passes label 'Welcome from <name>'",
    calls1[0].label === "Welcome from Billing Support Rep",
  );

  section("A21.4 triggerAutoHandshake — disabled toggle");
  const { client: c2, calls: calls2 } = makeStubClient("should-not-be-used");
  const r2 = await triggerAutoHandshake({
    client: c2,
    newAgentId: "billing-support-rep",
    newAgentName: "Billing Support Rep",
    operator: { name: "Henry Zhang" },
    enabled: false,
  });
  check("returns null when enabled=false", r2 === null);
  check(
    "does NOT call createChatSession when disabled",
    calls2.length === 0,
  );

  section("A21.5 triggerAutoHandshake — missing agentId");
  const { client: c3, calls: calls3 } = makeStubClient("k");
  const r3 = await triggerAutoHandshake({
    client: c3,
    newAgentId: "",
    newAgentName: null,
    operator: { name: "Henry Zhang" },
  });
  check("returns null when newAgentId is empty", r3 === null);
  check("does NOT call createChatSession on empty agentId", calls3.length === 0);

  section("A21.6 triggerAutoHandshake — operator email fallback");
  const { client: c4, calls: calls4 } = makeStubClient(
    "agent:x:dashboard:e",
  );
  await triggerAutoHandshake({
    client: c4,
    newAgentId: "x",
    newAgentName: "X",
    operator: { name: null, email: "info@sentura.ai" },
  });
  check(
    "falls back to operator email when name missing",
    typeof calls4[0].initialMessage === "string"
      && calls4[0].initialMessage!.includes("info@sentura.ai"),
  );

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
