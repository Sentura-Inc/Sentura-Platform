# Sentura Tests — Cross-Team Integration

> Detailed test cases. Summary matrix lives in `docs/TESTS.md`. Read on demand.

## Cross-Team Integration Tests

These tests verify that deliverables from different team members work together correctly.

### X1. Setup → Agent Registration → Dashboard Display

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| X1.1 | Full setup flow | Follow docs/SETUP.md end-to-end, then run `sentura-setup.sh` | Gateway running; meta-agents registered; dashboard starts |
| X1.2 | Meta-agents not in roster | After setup, load `/employees` in dashboard | `creator`, `tuner`, `orchestrator` NOT shown in the employee table |
| X1.3 | GradSale agent in roster | Register `cs-agent-gradsale` via CLI, load `/employees` | Agent appears with correct name, model, tools |

### X2. Bootstrap Hook → Workspace Convention → Agent Behavior

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| X2.1 | AGENTS.md Hard Rules respected | Create agent with a clear Hard Rule in `AGENTS.md § Hard Rules`, test with a prompt that would violate it | Agent refuses to violate the boundary defined in Hard Rules |
| X2.2 | BOOTSTRAP.md Enterprise Context available | Create agent with enterprise-specific knowledge under `BOOTSTRAP.md § Enterprise Context`, ask about it | Agent references the enterprise context in its response |
| X2.3 | Convention compliance | Check `workspaces/cs-agent-gradsale/` against `docs/workspace-convention.md` | All 8 native files present; AGENTS.md has `§ Hard Rules`; BOOTSTRAP.md has `§ Enterprise Context`; file content follows documented structure |

### X3. Config Schema Consistency

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| X3.1 | All configs use correct schema | Grep all `config.json5` files for deprecated patterns | No occurrences of `agents.entries`, `systemPrompt`, `tools.allowlist`, `tools.denylist` |
| X3.2 | Config patch works | Apply any template's config.json5 via `config.patch` | Agent appears in `agents.list`; gateway accepts the config without errors |
| X3.3 | Template placeholders | Check that no template config has unresolved placeholders in use | All `{placeholder}` values are documented in template README |

### X4. Dashboard ↔ Gateway Protocol

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| X4.1 | Dashboard connects | Start gateway + dashboard; load dashboard | Connection status shows "Connected" (green dot) |
| X4.2 | Dashboard disconnects gracefully | Stop gateway while dashboard is open | Connection status shows "Disconnected" or "Reconnecting"; no page crash |
| X4.3 | Overview stats accurate | Load `/` with agents registered | Employee count matches `config.get agents.list` length (minus 3 meta-agents) |

### X5. Extension ↔ Policy Alignment

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| X5.1 | RBAC roles match README | Compare `sentura-rbac/src/roles.ts` role IDs with README §15 table | All 5 roles present with matching names and descriptions |
| X5.2 | Audit event types cover all hooks | Compare `sentura-audit/src/types.ts` AuditEventType with registered hooks in `index.ts` | Every registered hook produces at least one audit event type |
| X5.3 | Approval policies reference valid tools | Check tool names in `approval-policies.json5` | Tool names match OpenClaw's tool catalog (browser_navigate, mcp_*, etc.) |

---

## Test Results Summary Template

Use this template to record test results:

```
Date: ____
Tester: ____
Gateway version: ____
Node version: ____

Person A: __ / 98 passed   (74 + 12 A14 sandbox-seed + 12 A15 sentura-agents extension cases)
Person B: __ / 101 passed  (65 + 20 B12 live-gateway + 6 B6.2 deployment-skill rewrite + 10 B6.9 live E2E cases)
Person C: __ / 85 passed   (33 Week 1 + 52 Week 2 cases across C2.11–C10.17)
Person D: __ / 31 passed (22 automated + 9 manual)
Cross-team: __ / 13 passed

Total: __ / 328

Notes:
- ...
```
