# Sentura Tests — Person B (AI Employee & Skills)

> Detailed test cases. Summary matrix lives in `docs/TESTS.md`. Read on demand. Includes Creator Bug-Fix Rounds B6.x.

### B6.2. Week 2 — `employee-deployment` skill rewrite (deployment-pipeline repair)

Updated in lockstep with A15; verifies Forge no longer uses `fs_write` for new-employee workspaces.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B6.2.1 | Skill calls out `fs_write` restriction | `scripts/test-week2.ts` Part 12 | SKILL.md explicitly warns about the read-only sandbox and forbids `fs_write` for new-employee files |
| B6.2.2 | Skill references `agents.files.set` | Same | SKILL.md uses `agents.files.set` for the 8 native files |
| B6.2.3 | Skill references `sentura.agents.writeSubfile` | Same | SKILL.md uses `sentura.agents.writeSubfile` for `skills/`, `ekg/`, `memory/users/` files |
| B6.2.4 | Legacy instruction removed | Same | SKILL.md no longer contains the "Use `fs_write` for each file" instruction |
| B6.2.5 | Creator allows the new tool | Same | `sentura/agents/creator/config.json5` `tools.alsoAllow` contains `sentura_agents_manage` |
| B6.2.6 | Live deployment smoke test | Chat with Forge: "incubate a minimal billing-support employee named Remy with 1 skill and deploy" | Deployment completes; host `~/.openclaw/workspace/remy-billing-support/` has 8 native files + `skills/<name>/SKILL.md` + optional `ekg/` files; no `Sandbox path is read-only` error |

### B6.3. Week 2 — Creator `AGENTS.md` / `TOOLS.md` / `BOOTSTRAP.md` Hard Rule repair (round 4)

Hard Rules live at the top of `AGENTS.md` and explicitly override every skill.
Round 3 only fixed skills, so Forge still followed the Hard Rules' `fs_write`
instruction and kept hitting `Sandbox path is read-only`. This section guards
against that regression.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B6.3.1 | AGENTS.md Hard Rules forbid `fs_write` for employees | `rg -n "fs_write" sentura/agents/creator/AGENTS.md` | Every match is a prohibition (e.g. "NEVER via `fs_write`", "`fs_write` cannot write to…"); zero prescriptive lines like "use `fs_write`" |
| B6.3.2 | AGENTS.md Hard Rules prescribe `sentura_agents_manage` flow | `rg -n "sentura_agents_manage" sentura/agents/creator/AGENTS.md` | Hard Rules section lists the 3-step flow: `create_agent` → `write` (native + skills) → `gateway.config.patch` |
| B6.3.3 | Phase 5 deploys via `sentura_agents_manage` | Read `sentura/agents/creator/AGENTS.md` § Phase 5 | Steps 1–3 call `sentura_agents_manage` with `create_agent` and `write`; step 4 uses `gateway` `config.patch`; there is no `fs_write` prescription anywhere in Phase 5 |
| B6.3.4 | TOOLS.md promotes `sentura_agents_manage` to primary | Read `sentura/agents/creator/TOOLS.md` | `sentura_agents_manage` row exists and is labelled "Primary workspace tool"; the `fs_read`/`fs_write` row is downgraded to "scratch-only, inside your own sandbox" |
| B6.3.5 | BOOTSTRAP.md bootstrap check lists `sentura_agents_manage` first | Read `sentura/agents/creator/BOOTSTRAP.md` step 4 | Lists `sentura_agents_manage` as a mandatory tool and notes that `fs_write` cannot reach `/workspace/.openclaw/workspace/<agent>/…` |
| B6.3.6 | config.json5 header matches reality | Read `sentura/agents/creator/config.json5` header comment | Header references `sentura_agents_manage`, not "coding profile for fs_write" |
| B6.3.7 | Host workspace kept in sync | `diff sentura/agents/creator/{AGENTS,TOOLS,BOOTSTRAP}.md ~/.openclaw/workspace/creator/{AGENTS,TOOLS,BOOTSTRAP}.md` | All three diffs are empty (host copy was re-synced as part of the fix) |
| B6.3.8 | Deployment regression — no fs_write in trace | Chat with Forge: "deploy a minimal billing-support agent named Remy" | In the session trace, step 1 is `sentura_agents_manage{action:"create_agent"}`; zero `fs_write` tool invocations target any `.openclaw/workspace/<agent>/…` or `/workspace/generated/…` path; terminal shows zero `Sandbox path is read-only` lines; the new agent appears in the dashboard after the `config.patch` |

### B6.4. Week 2 — Creator tool-policy deny-list enforcement (round 5)

Round 4 rewrote Hard Rules to forbid `fs_write` for employee workspaces,
but Forge still selected the built-in `write` tool (which the `coding`
profile exposes) and kept hitting `Sandbox path is read-only`. Rules at
the prompt layer are not binding on the model; the only reliable
enforcement is removing the competing tool from the resolved tool set.
This section verifies the `deny:` policy stays in place.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B6.4.1 | Source config denies `write`/`edit`/`apply_patch` | `rg -n "deny" sentura/agents/creator/config.json5` | `tools.deny` contains exactly `["write","edit","apply_patch"]` |
| B6.4.2 | Setup script re-applies deny list | `rg -n "deny.*write.*edit.*apply_patch" scripts/sentura-setup.sh` | `overrides.creator.tools.deny` has the same three entries so every `pnpm sentura:setup` run restores the policy |
| B6.4.3 | Live openclaw.json has deny list | `node -e "console.log(JSON.parse(require('fs').readFileSync(process.env.HOME+'/.openclaw/openclaw.json','utf8')).agents.list.find(a=>a.id==='creator').tools.deny)"` | Output is `[ 'write', 'edit', 'apply_patch' ]` |
| B6.4.4 | `sentura_agents_manage` still allowed | Same config, inspect `tools.alsoAllow` | Still contains `sentura_agents_manage` so Forge has a workspace-write path |
| B6.4.5 | Stale sandbox cleared | `ls ~/.openclaw/sandboxes/ \| grep agent-creator` | Either empty or only sandboxes created AFTER the deny-list was applied (they will reseed the new tool set) |
| B6.4.6 | Tool manifest in trace | Chat with Forge: "list your writing tools" | Reply mentions `sentura_agents_manage` and explicitly NOT `write`, `edit`, or `apply_patch` |
| B6.4.7 | Deployment regression — zero `write` invocations | Chat with Forge: "deploy a minimal billing-support agent named Ada" | Trace contains zero `write`/`edit`/`apply_patch` calls; every file lands via `sentura_agents_manage`; terminal has zero `Sandbox path is read-only` lines |

### B6.5. Week 2 — Owner-authorization grant for webchat operator (round 6)

Round 5 removed `write`/`edit`/`apply_patch` but Forge still refused to
deploy, saying "the deployment tools are not exposed in this session"
and "this sandbox does not expose the `gateway` tool". Root cause:
`gateway`, `cron`, and `nodes` are owner-only tools
(`openclaw/src/agents/tools/owner-only-tools.ts`) that are stripped from
the tool manifest whenever `senderIsOwner === false`. Our
`commands.ownerAllowFrom` was unset, so every webchat message — even
from the local operator — was treated as non-owner and `alsoAllow:
["gateway", …]` was silently discarded. The fix is to authorize the
local operator as owner via `commands.ownerAllowFrom: ["*"]`.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B6.5.1 | Live config grants owner | `node -e "console.log(JSON.parse(require('fs').readFileSync(process.env.HOME+'/.openclaw/openclaw.json','utf8')).commands?.ownerAllowFrom)"` | Output is `[ '*' ]` |
| B6.5.2 | Setup script persists grant | `rg -n "ownerAllowFrom" scripts/sentura-setup.sh` | Matches the `config.commands.ownerAllowFrom = ['*']` block that runs during `pnpm sentura:setup` |
| B6.5.3 | Setup script only sets when unset | Read the surrounding block in `scripts/sentura-setup.sh` | The assignment is guarded by `!Array.isArray(...) \|\| .length === 0`, so an operator-scoped ID configured by the user is preserved |
| B6.5.4 | Owner-only tools still declared in `alsoAllow` | `rg -n "'gateway'" scripts/sentura-setup.sh sentura/agents/creator/config.json5` | Both source files keep `gateway` in `alsoAllow` so the ownership grant can surface it |
| B6.5.5 | Stale Creator sandbox cleared | `ls ~/.openclaw/sandboxes 2>/dev/null \| grep agent-creator \|\| echo none` | `none`, or only sandboxes created AFTER Round 6 |
| B6.5.6 | Tool manifest in trace — gateway present | Chat with Forge: "list your tools" | Reply includes `gateway` (with actions `config.get`, `config.patch`, etc.) and `sentura_agents_manage` |
| B6.5.7 | End-to-end deployment | Chat with Forge: "deploy a minimal billing-support agent named Remy" | Trace includes `gateway { action: "config.get" }`, `sentura_agents_manage { action: "create_agent" }`, eight `sentura_agents_manage { action: "write" }` native-file calls, skill writes, and a final `gateway { action: "config.patch" }`. Dashboard shows the new employee in `agents.list`. Gateway logs contain zero `Sandbox path is read-only` lines and zero `Path escapes sandbox root` lines. |

### B6.6. Week 2 — `tools.exec.host` pinned to `gateway` (round 7)

After round 6 the gateway/agents tools were technically in Forge's
manifest, but Forge still reported "deployment tools are not exposed."
The only remaining tool error in the gateway log was:

```
[tools] exec failed: exec host not allowed
  (requested gateway; configured host is auto; …)
  raw_params={…,"host":"gateway",…}
```

Root cause: `tools.exec.host` defaulted to `"auto"`. When a sandbox is
available, `bash-tools.exec-runtime.ts:isRequestedExecTargetAllowed`
explicitly rejects an `exec` call that asks for `host: "gateway"` under
the `auto` policy. Forge's probe (`which openclaw || openclaw gateway
status`) was its way of confirming the gateway was reachable; the
rejection convinced it that the gateway tool itself was missing. The
fix is to pin `tools.exec.host: "gateway"` in the live config and in
the setup script.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B6.6.1 | Live config pins exec host | `node -e "console.log(JSON.parse(require('fs').readFileSync(process.env.HOME+'/.openclaw/openclaw.json','utf8')).tools?.exec?.host)"` | Output is `gateway` |
| B6.6.2 | Setup script persists pin | `rg -n "tools.exec.host" scripts/sentura-setup.sh` | Matches the `config.tools.exec.host = 'gateway'` block that runs during `pnpm sentura:setup` |
| B6.6.3 | Setup script only sets when missing | Read surrounding block in `scripts/sentura-setup.sh` | The assignment is guarded by `if (config.tools.exec.host !== 'gateway')`, so operator-customized hosts (e.g. `"sandbox"`) are preserved |
| B6.6.4 | Gateway hot-reload picked up change | `rg "config change applied.*tools.exec" ~/.openclaw/logs/openclaw-*.log /tmp/openclaw/openclaw-*.log 2>/dev/null` | Matches at least one line like `[reload] config change applied (dynamic reads: tools.exec)` |
| B6.6.5 | No pending `exec host not allowed` errors | `rg -n "exec host not allowed" /tmp/openclaw/openclaw-*.log` in a fresh run | Zero matches after the hot-reload line |
| B6.6.6 | Stale Creator sandbox cleared | `ls ~/.openclaw/sandboxes 2>/dev/null \| grep agent-creator \|\| echo none` | `none`, or only sandboxes created AFTER Round 7 |
| B6.6.7 | Forge's self-probe succeeds | New chat with Forge: "before you do anything, run `which openclaw` and tell me what you see" | Forge returns the `openclaw` CLI path with zero `exec host not allowed` errors in gateway log |
| B6.6.8 | End-to-end deployment still works | Chat with Forge: "deploy a minimal agent named Remy" | Trace includes the gateway/sentura_agents_manage calls from B6.5.7; zero `exec host not allowed` and zero `Sandbox path is read-only` lines in gateway log |

### B6.7. Week 2 — Creator subagent-spawn denial + `exec` removal (round 10)

Between rounds 7–9 a follow-up deploy attempt surfaced a new failure
mode: Forge (running `openai/gpt-5.3-codex`) hallucinated a call to
`sessions_spawn({ task: "noop", runTimeoutSeconds: 1 })`. The `1` was
passed straight through to the embedded-run timeout as `1000ms`, the
spawned subagent had no `SOUL.md` and returned nothing, and Forge's
entire user-facing reply collapsed to the literal string `"noop"`. No
agent was deployed.

Root cause: `openclaw/src/agents/tool-catalog.ts` registers
`sessions_spawn`, `subagents`, and `sessions_yield` with
`profiles: ["coding"]`, so Forge's `coding` profile allowlist already
shipped all three tools. A previous attempt to remove `sessions_spawn`
from `tools.alsoAllow` was a no-op because `alsoAllow` is additive-only.
The only way to block a profile-included tool is through `tools.deny`
(`openclaw/src/agents/tool-policy-match.ts` checks `deny` before any
`allow` path).

Round 10 also closes the previously-dangling `exec` case: `exec` had
been denied since round 8 but the creator's `AGENTS.md` still listed
it under "Tool Availability", which mis-advertised the toolkit to the
model.

Fix: add `sessions_spawn`, `subagents`, `sessions_yield` to
`creator.tools.deny` in the source config, the live config, and the
creator's `AGENTS.md`. Remove `exec` from AGENTS.md's "available"
list; list it explicitly under "Denied intentionally" with rationale.
Sync the host copy byte-for-byte.

A separate warning — `tools.profile (coding) allowlist contains
unknown entries (gateway)` — is NOT a bug: it fires only for subagent
sessions (which intentionally strip `gateway` via
`SUBAGENT_TOOL_DENY_ALWAYS` in `pi-tools.policy.ts`). The main Forge
session gets `gateway` because control-ui connects with the
`operator.admin` scope that flips `senderIsOwner=true`. No fix needed.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B6.7.1 | Source config denies subagent tools | `rg -n "^\s+deny:" sentura/agents/creator/config.json5` | Matched line contains `sessions_spawn`, `subagents`, `sessions_yield` in addition to `write`, `edit`, `apply_patch`, `exec` |
| B6.7.2 | Live openclaw.json denies subagent tools | `node -e "const c=require(process.env.HOME+'/.openclaw/openclaw.json'); console.log(c.agents.list.find(a=>a.id==='creator').tools.deny)"` | Output is `[ 'write', 'edit', 'apply_patch', 'exec', 'sessions_spawn', 'subagents', 'sessions_yield' ]` |
| B6.7.3 | AGENTS.md does not advertise denied tools | `rg -n "sessions_spawn\|sessions_yield\|subagents\|\bexec\b" sentura/agents/creator/AGENTS.md` | Every match occurs inside the "Denied intentionally" block; zero matches inside the "available to you" list |
| B6.7.4 | AGENTS.md host copy synced | `diff -q sentura/agents/creator/AGENTS.md ~/.openclaw/workspace/creator/AGENTS.md` | No output (files are byte-identical) |
| B6.7.5 | Deny precedence verified in source | `rg -n "matchesAnyGlobPattern.*deny" openclaw/src/agents/tool-policy-match.ts` | Matches the early-return `return false` that runs before any `allow` check, confirming `deny` beats profile allow |
| B6.7.6 | `gateway` warning is subagent-only | `rg -n "unknown entries.*gateway" ~/.openclaw/logs/openclaw-*.log /tmp/openclaw/openclaw-*.log 2>/dev/null \| rg "session=agent:creator:subagent"` | Every hit is for a subagent session; zero hits where the session id is the bare `agent:creator` main session |
| B6.7.7 | Stale Creator sandbox cleared | `ls ~/.openclaw/sandboxes 2>/dev/null \| grep agent-creator \|\| echo none` | `none`, or only sandboxes created after Round 10 so they reseed the new tool set |
| B6.7.8 | Regression — no subagent spawn during deploy | New chat: "deploy a minimal billing-support agent named Remy" | Gateway log contains zero `[agent:nested] session=agent:creator:subagent:` lines, zero `embedded run timeout: runId=… timeoutMs=1000` lines, and zero `Read: from ./SOUL.md failed` lines for the duration of this deploy |
| B6.7.9 | Regression — end-to-end deployment succeeds | Same chat session | Trace shows the B6.5.7 sequence (`gateway.config.get` → `sentura_agents_manage.create_agent` → 8× `sentura_agents_manage.write` → skills writes → `gateway.config.patch` → final `gateway.config.get` verify); `agents.list` returns the new `billing-support-rep` entry |

### B6.8. Week 2 — Creator sandbox `workspaceAccess: "rw"` (round 11)

A deep audit of `openclaw/src/agents/sandbox/` revealed that Rounds
6–10's edits to the Creator's workspace docs (AGENTS.md, TOOLS.md,
BOOTSTRAP.md) were not reaching the running agent. The sandbox
workspace-seed function
(`openclaw/src/agents/sandbox/workspace.ts:17-59`,
`ensureSandboxWorkspace`) uses `fs.writeFile(..., {flag: "wx"})`,
which only writes when the destination is missing — there is no
mtime-based refresh. With the default `workspaceAccess: "none"`, the
`/workspace` bind mount points at a separate host dir
(`~/.openclaw/sandboxes/agent-creator-<hash>/`) that is seeded
one-time. The agent kept reading a pre-round-10 AGENTS.md that still
advertised `sessions_spawn`, `sessions_yield`, `subagents`, and
`exec`, which is why the deny-list fix looked invisible from the
model's perspective.

Fix: set `sandbox.workspaceAccess: "rw"` in both the source config
and the live config. With `"rw"`
(`openclaw/src/agents/sandbox/workspace-mounts.ts:14-40`),
`/workspace` becomes a live bind of `~/.openclaw/workspace/creator/`,
so host edits are visible on the next boot without manual cleanup.
Safety: acceptable because `tools.deny` already strips `write`,
`edit`, `apply_patch`, and `exec` from Forge's tool schema, and
`sentura_agents_manage` targets other agents' workspaces, not
Forge's own. `sandbox.mode: "non-main"` still isolates Forge from
the host Sentura repo.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B6.8.1 | Source config sets rw | `rg -n "workspaceAccess" sentura/agents/creator/config.json5` | Matches a line inside the creator's `sandbox` block with `workspaceAccess: "rw"` |
| B6.8.2 | Live openclaw.json sets rw | `node -e "const c=require(process.env.HOME+'/.openclaw/openclaw.json'); console.log(c.agents.list.find(a=>a.id==='creator').sandbox)"` | Output is `{ mode: 'non-main', workspaceAccess: 'rw' }` |
| B6.8.3 | Sandbox docker flag is not read-only | Restart gateway, send one message to Forge, then `docker inspect openclaw-sbx-<creator-slug> --format '{{json .Mounts}}'` | The `/workspace` mount has `RW: true` and `Source` equals `~/.openclaw/workspace/creator` |
| B6.8.4 | Host edits propagate to the container | Edit a trailing line in `~/.openclaw/workspace/creator/AGENTS.md`, restart gateway, ask Forge what its AGENTS.md ends with | Forge's `read` of `/workspace/AGENTS.md` returns the newly-added line, without needing to delete the sandbox dir |
| B6.8.5 | Old sandbox path unused | `ls ~/.openclaw/sandboxes 2>/dev/null \| grep agent-creator \|\| echo none` after several Forge runs | `none` — no separate seed dir is created for Creator when `workspaceAccess: "rw"` is active (`openclaw/src/agents/sandbox/context.ts:47` resolves `workspaceDir` to the live agent dir) |
| B6.8.6 | Forge still cannot mutate its own docs | Ask Forge to overwrite its own `SOUL.md` | Forge reports that `write` / `edit` / `apply_patch` are not available (they are denied) and does not modify the file; `sentura_agents_manage` rejects the call because it validates `agentId` against its parameter rather than silently overwriting Forge's workspace |

### B6.9. Week 2 — Creator Agent TRUE end-to-end live run (round 13) — **PASSING**

This is the canonical Week-2-close-out test for Person B: drive Forge
with a real LLM against a real NL brief and prove a working AI employee
emerges. Round 13 is the first round that exercises this path; it
passed on the first clean run after the config/credential blockers
from rounds 11–12 were resolved.

**Preconditions** (must all hold before invoking the harness):
- `~/.openclaw/.env` exists (mode 600) with a valid `OPENAI_API_KEY`.
- `creator.model` is paired with a provider that accepts plain API-key
  auth (e.g. `openai/gpt-5.4`). `openai/gpt-5.3-codex` requires
  OpenAI Codex OAuth and will fail fast at the first LLM call.
- Live `openclaw.json` has a `bindings[]` entry for `webchat` DMs →
  `creator` so routing does not fall back to `agent:main:main`.
- `creator.sandbox.workspaceAccess = "rw"` so Forge sees the latest
  host copies of `AGENTS.md`/`TOOLS.md`/`BOOTSTRAP.md` (see B6.8).
- `~/.openclaw/sandboxes/agent-creator-*` does NOT exist (stale mirror
  would mask host edits even with `rw`).
- Gateway is running (`cd openclaw && pnpm gateway:watch`).

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B6.9.1 | Harness gate respected | `npx tsx scripts/test-creator-e2e-live.ts` (no env var) | Exits 0 with "Skipped: SENTURA_LLM_E2E != 1" — guards against accidental LLM spend |
| B6.9.2 | Token-auth preserves admin scope | `SENTURA_LLM_E2E=1 npx tsx scripts/test-creator-e2e-live.ts` | Client connects and `config.get` returns without `not authorized: missing scope operator.admin` — proves token auth preserves scopes (unlike Control UI's insecure path) |
| B6.9.3 | Routing bypass works | Inspect harness output | Script logs `Creator acknowledged the brief; running Phase 1-4` — proves the `agent` RPC reached `agentId: "creator"` directly without binding resolution |
| B6.9.4 | Forge completes within budget | Same harness run | Harness prints `✓ PASS: Creator produced a live AI employee end-to-end` before the 5-minute deadline. Round 13 baseline: poll #22 (~110s) on `openai/gpt-5.4`. |
| B6.9.5 | New agent registered in live config | After harness exit 0: `node -e "const c=require(process.env.HOME+'/.openclaw/openclaw.json'); console.log(c.agents.list.find(a=>a.id===process.argv[1]))" <new-id>` | Entry has `id`, `name`, `model`, `runtime.type: "embedded"`, `sandbox.mode: "non-main"`, a `tools` block with `profile` + `deny`, and `skills` glob pointing at the new workspace |
| B6.9.6 | 8-file workspace materialized | `ls ~/.openclaw/workspace/<new-id>/` | All 8 OpenClaw-native files present: `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `BOOTSTRAP.md`, `HEARTBEAT.md`, `IDENTITY.md`, `MEMORY.md`, `USER.md`, plus a `skills/` directory |
| B6.9.7 | NL intent → Hard Rules translation | `rg -n "Hard Rules" ~/.openclaw/workspace/<new-id>/AGENTS.md` and inspect the section | The financial/approval/safety boundaries stated in the NL brief appear verbatim or semantically equivalent under `## Hard Rules (must not override)`. Round 13 baseline: the "> £5000 → human approval" rule from the Penny brief was correctly emitted as three hard rules (NEVER approve, NEVER mark > £5000 approved, ALWAYS route > £5000 to human). |
| B6.9.8 | Skills directory is non-empty | `ls ~/.openclaw/workspace/<new-id>/skills/` | At least one skill directory exists with a populated `SKILL.md` (Round 13 baseline: `accounts-payable-reconciliation/`) |
| B6.9.9 | No subagent-spawn or 1000ms timeout regression | `grep -E 'subagent|embedded run timeout' /tmp/openclaw/openclaw-*.log` during the E2E run | Zero matches. Confirms the Round 10 denial of `sessions_spawn`/`subagents`/`sessions_yield` + AGENTS.md sync is still holding when Forge is driven by a real LLM, not just by canned tool calls. |
| B6.9.10 | No missing-auth provider error | `grep -E 'No API key found for provider|Unknown model' /tmp/openclaw/openclaw-*.log` during the E2E run | Zero matches. Confirms both the `.env` wiring and the model↔provider pairing are correct. |

**Known loose-assertions (deferred to Week 3 Person B hardening):**
- B6.9 does not verify schema conformance of the new `config.json5`
  entry beyond top-level fields, nor memory-namespace isolation, nor
  binding correctness of the new agent. Tighten by adding B6.9.11–15
  once Forge's `employee-deployment` skill is augmented to cover them.
- Harness does not clean up the created agent; operator must remove
  it via `config.patch` when done. Cleanup automation is out-of-scope
  for Week 2.

---

---

## Person B — AI Employee & Skills Engineer

### B1. Creator Agent Workspace

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B1.1 | All workspace files present | `ls sentura/agents/creator/` | Contains: SOUL.md, AGENTS.md, IDENTITY.md, BOOTSTRAP.md, HEARTBEAT.md, TOOLS.md, USER.md |
| B1.2 | Skills directory | `ls sentura/agents/creator/skills/` | Contains 3 subdirectories: `incubation/`, `role-research/`, `workspace-generation/` |
| B1.3 | Each skill has SKILL.md | `ls sentura/agents/creator/skills/*/SKILL.md` | All 3 skill files exist and are non-empty |
| B1.4 | SOUL.md identity | Read `sentura/agents/creator/SOUL.md` | Contains agent name "Forge", 5-phase incubation mission, operating principles |
| B1.5 | AGENTS.md protocol | Read `sentura/agents/creator/AGENTS.md` | Contains phases 1-5, output format, red lines; references `agents.list` array (not object map) |
| B1.6 | config.json5 valid schema | Read `sentura/agents/creator/config.json5` | Uses `agents.list[]` array; `id: "creator"`; `tools.profile: "coding"`; no `workspace` field; no `systemPrompt` field |
| B1.7 | No incorrect schema patterns | Grep all config.json5 files for `agents.entries`, `systemPrompt`, `tools.allowlist` | Zero matches — these are the old incorrect schema patterns |
| B1.8 | Creator Agent loads | After setup script, start a session with the Creator agent | Agent responds; identifies itself as Forge; knows its incubation protocol |

### B2. Workspace Convention (`docs/workspace-convention.md`)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B2.1 | All 8 native files documented | Read `docs/workspace-convention.md` | Documents all 8 OpenClaw native files + skills/ directory + memory/users/; explains that Hard Rules live inside AGENTS.md `## Hard Rules` and Enterprise Context lives inside BOOTSTRAP.md `## Enterprise Context` |
| B2.2 | File priority order | Check convention doc | Priority chain: AGENTS.md `§ Hard Rules` > Skills Safety > SOUL.md Escalation > AGENTS.md general > BOOTSTRAP.md `§ Enterprise Context` Policies > SOUL.md Personality |
| B2.3 | Runtime vs design-time | Check convention doc | Explains `workspaces/` in git = reference, `~/.openclaw/workspace/` = runtime, `sentura/config/templates/` = starting templates |
| B2.4 | No `workspace` field rule | Check convention doc | Explicitly states: omit `workspace` from agent configs; let OpenClaw resolve to `~/.openclaw/workspace/{agent-id}/` |
| B2.5 | Cross-team notes | Check convention doc | Contains guidance for Person C (dashboard display), Person D (extension interaction) |

### B3. Role Templates

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B3.1 | Three templates exist | `ls sentura/config/templates/` | Contains `ap-clerk/`, `cs-agent/`, `sdr/` directories + `README.md` |
| B3.2 | Template structure | `ls sentura/config/templates/cs-agent/` | Contains: config.json5, all 8 native workspace files (AGENTS.md with Hard Rules, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md with Enterprise Context, MEMORY.md), skills/ directory with at least 2 skills |
| B3.3 | Placeholders used | Grep templates for `{` placeholder pattern | All templates use `{placeholder}` convention for customizable values (e.g. `{agent-id}`, `{company-name}`) |
| B3.4 | Config schema correct | Read each template's config.json5 | Uses `agents.list[]` array format; no `workspace` field; no `systemPrompt`; appropriate `tools.profile` and deny lists |
| B3.5 | AP Clerk tools | Read `sentura/config/templates/ap-clerk/config.json5` | Allows `pdf` tool; denies `browser`, `exec`, `gateway` |
| B3.6 | CS Agent tools | Read `sentura/config/templates/cs-agent/config.json5` | `minimal` profile; allows `web_search`, `web_fetch`; denies `exec`, `gateway` |
| B3.7 | SDR tools | Read `sentura/config/templates/sdr/config.json5` | Allows `browser` (for research/outreach); denies `exec`, `gateway` |
| B3.8 | Template README | Read `sentura/config/templates/README.md` | Documents template structure, placeholder convention, how to add new templates |

### B4. Platform Skills

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B4.1 | Self-provisioning skill exists | `ls sentura/skills/self-provisioning/SKILL.md` | File exists and is non-empty |
| B4.2 | Self-provisioning procedure | Read the skill | Contains 8-step procedure; approval routing table; error handling for CAPTCHA/2FA/rate limits; secret store naming convention |
| B4.3 | No secrets in workspace rule | Read the skill | Explicitly states credentials go to secret store, never workspace files or conversation |
| B4.4 | Knowledge-curation skill exists | `ls sentura/skills/knowledge-curation/SKILL.md` | File exists and is non-empty |
| B4.5 | Knowledge classification | Read the skill | Documents classification routing: procedural → SKILL.md, contextual → BOOTSTRAP.md `§ Enterprise Context`, safety → AGENTS.md `§ Hard Rules` (with approval), reference → data/ |
| B4.6 | Source handling | Read the skill | Handles URLs, PDFs, API docs, verbal descriptions |

### B5. Test Employee (GradSale CS Agent)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B5.1 | Workspace files present | `ls workspaces/cs-agent-gradsale/` | All 8 native workspace files + config.json5 + skills/ directory present |
| B5.2 | GradSale context | Read AGENTS.md `§ Hard Rules` and BOOTSTRAP.md `§ Enterprise Context` | References real GradSale entities (listings, transactions, disputes) from `ekg/` docs |
| B5.3 | Skills reference real APIs | Read `skills/support-triage/SKILL.md` and `skills/dispute-resolution/SKILL.md` | Reference actual GradSale admin API endpoints from `ekg/api-admin.md` |
| B5.4 | MCP server references | Read config.json5 | Contains `mcp.servers` for `gradsale-admin` and `gradsale-web`; secrets use env var references (`$secret.`) |
| B5.5 | Config schema correct | Read config.json5 | Uses `agents.list[]` format; no `workspace` field; denies `exec`, `gateway`, `browser` |

### B6. Creator Agent Phase Skills (Week 2)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B6.1 | Phase 1 skill exists | `ls sentura/agents/creator/skills/research-and-discovery/SKILL.md` | Non-empty; has sections When to Use, Procedure (7+ steps), Tools Needed, Safety |
| B6.2 | Phase 1 covers clarifying Qs | Read skill | Contains numbered clarifying questions list; industry classification step; memory search step |
| B6.3 | Phase 2 skill exists | `ls sentura/agents/creator/skills/employee-design/SKILL.md` | Non-empty; produces a design bundle with config, bindings, MCP refs, workspace files, EKG, pluginConfig |
| B6.4 | Phase 2 enforces isolation | Grep skill for `memory-lancedb` and `dbPath` | Mandates per-agent `memory-lancedb.dbPath` in plugin config |
| B6.5 | Phase 2 enforces Hard Rules + Enterprise Context | Read skill | Step 7 generates AGENTS.md with a `## Hard Rules (must not override)` section (explicit categories, minimum 3 rules per category) AND BOOTSTRAP.md with a `## Enterprise Context` section (Company / Organization / Systems / Policies). |
| B6.6 | Phase 4 skill exists | `ls sentura/agents/creator/skills/employee-deployment/SKILL.md` | Non-empty; covers preconditions, workspace write, plugin config, config.patch, smoke test, rollback |
| B6.7 | Phase 4 enforces smoke test | Grep skill | Includes smoke test step with session spawn + validation + rollback on failure |
| B6.8 | Phase 4 includes audit | Grep skill for `sentura.audit` | Includes `agent.deployed` audit log entry with caller userToken |

### B7. EKG Schema (Week 2)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B7.1 | Schema reference exists | `ls sentura/config/ekg-schema.json5` | File present and non-empty |
| B7.2 | 4 pillars documented | Grep schema | Documents org/, rules/, assets/, workflows/ pillars |
| B7.3 | Experience Link format | Grep schema | Includes pattern, observation, confidence, occurrences fields |
| B7.4 | Provenance fields | Grep schema | Includes source document, ingestion date, confidence score |
| B7.5 | Industry Ontology format | Grep schema | Documents merge semantics and template format |

### B8. Industry Ontologies (Week 2)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B8.1 | Financial-services template | `ls sentura/config/industry-ontologies/financial-services/{org,rules,assets,workflows}/` | All 4 pillars populated with JSON5 files + README.md |
| B8.2 | Financial-services rules | Read `rules/financial-controls.json5` + `rules/compliance.json5` | Includes SOX, AML/KYC, PCI-DSS, 3-way match, payment thresholds |
| B8.3 | E-commerce template | `ls sentura/config/industry-ontologies/e-commerce/{org,rules,assets,workflows}/` | All 4 pillars populated with JSON5 files + README.md |
| B8.4 | E-commerce rules | Read `rules/consumer-protection.json5` + `rules/fraud-detection.json5` | Includes return/refund, chargeback, MAP, velocity checks |

### B9. MCP Builder Agent (Week 2)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B9.1 | Workspace complete | `ls sentura/agents/mcp-builder/` | Contains config.json5 + all 10 workspace files (AGENTS, SOUL, TOOLS, IDENTITY, USER, HEARTBEAT, BOOTSTRAP, MEMORY, RULES, CONTEXT) |
| B9.2 | Four skills present | `ls sentura/agents/mcp-builder/skills/*/SKILL.md` | api-analysis, mcp-generation, smoke-test, register-server |
| B9.3 | Config schema correct | Read config.json5 | `agents.list[]`; `sandbox.mode = "non-main"`; `tools.profile = "coding"` with explicit gateway/web/browser allow |
| B9.4 | SOUL identity | Read SOUL.md | Name "Smith"; mission of generating MCP servers from API docs |
| B9.5 | AGENTS.md Hard Rules prohibitions | Read the `## Hard Rules` section inside AGENTS.md | NEVER embed secrets; NEVER destructive ops without approval; ALWAYS RBAC verify |
| B9.6 | Model id is registered (round 14) | `rg -n '"model"' sentura/agents/mcp-builder/config.json5` | Value is `openai/gpt-5.4` (NOT `openai/gpt-4o` — the `openai` provider in `openclaw/extensions/openai/openai-provider.ts:57-68` only registers `gpt-5.4`, `gpt-5.4-pro`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.2`). No path-glob `skills:` entry, so OpenClaw auto-discovers all four workspace skills. |
| B9.7 | sessions_spawn denial matches Creator (round 14) | `rg -n 'deny|alsoAllow' sentura/agents/mcp-builder/config.json5` | `tools.deny` contains `sessions_spawn`, `subagents`, `sessions_yield`; `tools.alsoAllow` does NOT contain `sessions_spawn`. Prevents the Round-10 noop-hallucination loop when mcp-builder is first deployed. |

### B10. Common Skill Library (Week 2)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B10.1 | Library directory | `ls sentura/config/templates/_common/skills/` | 5 skill directories: meeting-notes, document-summarization, escalation-handling, status-update, knowledge-base-lookup |
| B10.2 | Each has SKILL.md | `find sentura/config/templates/_common/skills -name SKILL.md` | 5 files, all non-empty |
| B10.3 | Skill format | Read each SKILL.md | Contains When to Use, Procedure (numbered), Tools Needed, Safety sections |
| B10.4 | Library README | Read `sentura/config/templates/_common/README.md` | Lists all 5 skills; documents placeholder convention |
| B10.5 | Templates README updated | Read `sentura/config/templates/README.md` | References `_common/` library and the 5 common skills |

### B11. Creator Agent Helper Validation (Week 2)

> **Scope note:** This suite validates the *deterministic helper functions*
> (`sentura/lib/workspace.ts`, `sentura/lib/agent-registration.ts`,
> `sentura/lib/channel-bindings.ts`) with a hard-coded brief and design
> bundle. It is **NOT** a true LLM end-to-end test — no LLM is invoked and
> the Creator Agent's `SKILL.md` files are not executed. For a real
> LLM-driven Creator run, see the `B13. Creator Agent TRUE E2E` stub below.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B11.1 | Helpers script runs | `npx tsx scripts/test-creator-helpers.ts` | Exits 0; reports 49/49 passed |
| B11.2 | 10 workspace files produced | Inspect output | All 10 files created in temp workspace |
| B11.3 | EKG pillars created | Inspect output | org/, rules/, assets/, workflows/, workflows/experience-links/ all present |
| B11.4 | Industry ontology merged | Inspect output | roles.json5, financial-controls.json5, systems.json5, sops.json5 present in ekg/ |
| B11.5 | Skills copied | Inspect output | invoice-processing and vendor-management skills in skills/ |
| B11.6 | config.patch shape | Inspect output | Uses `agents.list[]`; has bindings, mcp.servers, plugins.entries."memory-lancedb".config.dbPath; uses `$secret.` references |
| B11.7 | Per-agent memory `dbPath` *emitted in patch* | Inspect output | `dbPath === "~/.openclaw/memory/{agentId}/lancedb"`. **Design-intent only** — the live `memory-lancedb` plugin currently treats `dbPath` as a single global setting; per-agent isolation today is collection-level (via `agentId` filtering), not per-file. |

### B13. Creator Agent TRUE E2E — Live LLM (Week 2, STUB)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B13.0 | Gate behaviour | `npx tsx scripts/test-creator-e2e-live.ts` (no env) | Prints "Skipped: SENTURA_LLM_E2E != 1" and exits 0 |
| B13.1 | Live Creator run (opt-in) | `SENTURA_LLM_E2E=1 npx tsx scripts/test-creator-e2e-live.ts` | Sends NL brief to `creator` agent; polls `config.get` for up to 5 min; passes if a new agent appears. Requires running gateway + provider creds. |

This test is **not run by default** and is not counted in the passing
total. It is the forward-looking harness for validating that the
Creator Agent actually works as an LLM-driven agent end-to-end.

#### B6–B11 Detailed Run Commands & Expected Outputs

All commands assume repo root (`/Users/henry/Desktop/Sentura-Platform`) and
Node 22+. No gateway required for B6–B11; these are purely structural /
offline tests.

**One-shot driver that covers B6.1–B11.7 (49 assertions):**

```bash
npx tsx scripts/test-creator-helpers.ts
```

Expected final output:

```
[SECTION] Summary
  Passed: 49
  Failed: 0
  Total:  49

[OK] All Creator Agent end-to-end tests passed.
```

Exit code `0` on full pass; non-zero otherwise.

**B6 — Per-skill quick checks:**

```bash
# B6.1 / B6.3 / B6.6 — all three phase skills present & non-trivial
wc -l sentura/agents/creator/skills/{research-and-discovery,employee-design,employee-deployment}/SKILL.md
# Expected: each file > 80 lines; none empty.

# B6.2 — clarifying Qs + memory-search procedure in Phase 1
rg -n "clarifying|memory.search|industry" sentura/agents/creator/skills/research-and-discovery/SKILL.md | head -20

# B6.4 — Phase 2 enforces per-agent memory isolation
rg -n "memory-lancedb|dbPath" sentura/agents/creator/skills/employee-design/SKILL.md
# Expected: at least one hit referencing `memory-lancedb.dbPath` with a per-agent template.

# B6.5 — Phase 2 generates RULES + CONTEXT
rg -n "RULES\.md|CONTEXT\.md" sentura/agents/creator/skills/employee-design/SKILL.md

# B6.7 — smoke test + rollback in Phase 4
rg -n "smoke.test|rollback|sessions.create" sentura/agents/creator/skills/employee-deployment/SKILL.md

# B6.8 — audit trail written on deploy
rg -n "sentura\.audit|agent\.deployed" sentura/agents/creator/skills/employee-deployment/SKILL.md
```

**B7 — EKG schema documentation:**

```bash
# B7.1 — file present
ls -l sentura/config/ekg-schema.json5

# B7.2 — all 4 pillars documented
rg -n "^//.*(org|rules|assets|workflows)/" sentura/config/ekg-schema.json5

# B7.3 — Experience Link fields
rg -n "pattern|observation|confidence|occurrences" sentura/config/ekg-schema.json5 | head

# B7.4 — provenance fields
rg -n "source|ingested|confidence" sentura/config/ekg-schema.json5

# B7.5 — industry ontology merge semantics documented
rg -n -i "ontology|merge|template" sentura/config/ekg-schema.json5
```

Note: `ekg-schema.json5` is documentation-only (all comments, no JSON body),
so `json5.parse` legitimately rejects it — don't pipe it into `json5`.

**B8 — Industry ontology templates:**

```bash
# B8.1 / B8.3 — both templates fully populated
find sentura/config/industry-ontologies -name '*.json5' | sort
# Expected: at least 11 files across financial-services/ and e-commerce/,
# covering org/, rules/, assets/, workflows/ in each.

# B8.2 — financial-services rule coverage
rg -n -i "SOX|AML|KYC|PCI|three.way|payment.threshold" \
  sentura/config/industry-ontologies/financial-services/rules/

# B8.4 — e-commerce rule coverage
rg -n -i "return|refund|chargeback|MAP|velocity" \
  sentura/config/industry-ontologies/e-commerce/rules/
```

**B9 — MCP Builder Agent workspace:**

```bash
# B9.1 — 8 native workspace files + config
ls sentura/agents/mcp-builder/
# Expected entries (order may vary):
#   AGENTS.md BOOTSTRAP.md HEARTBEAT.md IDENTITY.md
#   MEMORY.md SOUL.md TOOLS.md USER.md
#   config.json5 skills/

# B9.2 — 4 skills
ls sentura/agents/mcp-builder/skills/
# Expected: api-analysis/ mcp-generation/ smoke-test/ register-server/

# B9.3 — config schema invariants
rg -n 'agents:|sandbox|profile|"coding"' sentura/agents/mcp-builder/config.json5

# B9.4 — SOUL identity
rg -n -i "name|smith|mission|mcp" sentura/agents/mcp-builder/SOUL.md | head

# B9.5 — Hard Rules prohibitions (now inlined into AGENTS.md)
rg -n -i "NEVER|secret|destructive|RBAC|approval" sentura/agents/mcp-builder/AGENTS.md
```

**B10 — Common skill library:**

```bash
# B10.1 — 5 skill directories
ls sentura/config/templates/_common/skills/
# Expected: meeting-notes/ document-summarization/ escalation-handling/
#           status-update/ knowledge-base-lookup/

# B10.2 — each has SKILL.md
find sentura/config/templates/_common/skills -name SKILL.md
# Expected: 5 paths, all > 0 bytes.

# B10.3 — standard sections in each SKILL.md
for f in sentura/config/templates/_common/skills/*/SKILL.md; do
  echo "=== $f ==="
  rg -n "^## (When to Use|Procedure|Tools Needed|Safety)" "$f"
done
# Expected: each file shows all four headers.

# B10.4 / B10.5 — libraries referenced in both READMEs
rg -n "_common|meeting-notes|knowledge-base-lookup" \
  sentura/config/templates/README.md sentura/config/templates/_common/README.md
```

**B11 — Creator helper validation (offline, NOT a true LLM E2E):**

`scripts/test-creator-helpers.ts` simulates the Creator Agent's Phase 1/2/4
by calling the deterministic helpers (`workspace.ts`, `agent-registration.ts`,
`channel-bindings.ts`) with a hard-coded brief + design bundle. It writes
the generated workspace + patch body into a temp directory so nothing leaks
into `~/.openclaw/`. **No LLM is invoked** and the Creator's `SKILL.md`
files are not executed. Key assertions:

| Section | What the helper run proves |
|---------|----------------------------|
| B11.1 | Script exits 0, reports `49 / 49 passed` |
| B11.2 | Every one of the 10 workspace files is written (AGENTS, SOUL, TOOLS, IDENTITY, USER, HEARTBEAT, BOOTSTRAP, MEMORY, RULES, CONTEXT) |
| B11.3 | EKG directory contains `org/`, `rules/`, `assets/`, `workflows/`, `workflows/experience-links/` |
| B11.4 | Financial-services ontology files (`roles.json5`, `financial-controls.json5`, `systems.json5`, `sops.json5`) merged in |
| B11.5 | `skills/invoice-processing/SKILL.md` + `skills/vendor-management/SKILL.md` copied from `ap-clerk` template |
| B11.6 | Generated `config.patch` body uses `agents.list[]` (array), includes `bindings[]`, `mcp.servers`, and every secret is a `$secret.` reference |
| B11.7 | `plugins.entries["memory-lancedb"].config.dbPath === "~/.openclaw/memory/ap-clerk-acme/lancedb"` — per-agent path **shape** emitted by `buildAgentPatch`. The live `memory-lancedb` plugin does not currently honour per-agent dbPaths at runtime (see scope note on B11). |

To diff the generated patch body against a known-good snapshot (optional):

```bash
npx tsx scripts/test-creator-helpers.ts | rg -A 2 "config\.patch preview"
```

For the forward-looking live LLM harness (gated, not run by default), see
**B13. Creator Agent TRUE E2E** above.

### B12. Live Gateway Integration (Week 2)

Validates Person B's Week 2 deliverables against a **running OpenClaw gateway**
end-to-end: workspace generation, `config.patch` RPC acceptance, `config.get`
read-back, and cleanup. Requires gateway at `ws://localhost:18789`.

**Prereqs**:

```bash
cd openclaw && pnpm gateway:watch   # terminal 1 — leave running
# wait for "ready (N plugins, ...s)"
```

**Run**:

```bash
npx tsx scripts/test-week2-b-gateway.ts   # terminal 2
```

**Expected output**: `77 passed / 77 total` (exit 0). Script self-cleans — the
test agent and its workspace are removed whether tests pass or fail.

| # | Test | What the script verifies |
|---|------|--------------------------|
| B12.1 | Gateway token discoverable | `~/.openclaw/config.json` has `gateway.controlUi.token` |
| B12.2 | WebSocket handshake succeeds | `connect.challenge` → `connect` RPC resolves with protocol v4 |
| B12.3 | Creator Agent live-registered | `config.get → agents.list[]` contains `creator` agent |
| B12.4 | Creator Agent config intact | `creator` entry has `parameters.memoryDbPath` set to per-agent template |
| B12.5 | Workspace materialized on disk | All 8 native files (AGENTS/SOUL/TOOLS/IDENTITY/USER/HEARTBEAT/BOOTSTRAP/MEMORY.md) exist in `~/.openclaw/workspace/<test-agent-id>/` |
| B12.6 | EKG pillars created | `ekg/{org,rules,assets,workflows}/` directories exist in workspace |
| B12.7 | `memory/users/` created | Per-user sub-memory directory exists |
| B12.8 | Industry ontology merged | `ekg/rules/financial-controls.json5` copied from `sentura/config/industry-ontologies/financial-services/` |
| B12.9 | AGENTS.md Hard Rules present | `## Hard Rules (must not override)` section exists in AGENTS.md and contains `NEVER`/`ALWAYS` clauses |
| B12.10 | Per-agent dbPath format | `buildMemoryDbPath(id)` returns `~/.openclaw/memory/<id>/lancedb` |
| B12.11 | No inline secrets in patch | Patch JSON body contains `$secret.` references, never raw tokens |
| B12.12 | `config.patch` accepted by live gateway | RPC resolves OK; new agent count = previous + 1 |
| B12.13 | Reconnect after mcp.servers restart | Gateway restarts in-process (`[reload] config change requires gateway restart`); client reconnects cleanly after ~6s |
| B12.14 | Agent visible in `config.get` | New agent appears in `agents.list[]` post-restart |
| B12.15 | Sandbox enforced | Live agent has `sandbox.mode = "non-main"` |
| B12.16 | Tool denylist honored | `tools.deny` contains `"exec"` and `"gateway"` |
| B12.17 | MCP server registered | `mcp.servers["netsuite-test"]` present in live config |
| B12.18 | MCP env wired | Live MCP server's `env.NETSUITE_TOKEN` key present (value resolved from secret store at read time) |
| B12.19 | Slack binding registered | `bindings[]` contains entry matching `{agentId, match.channel: "slack"}` |
| B12.20 | Clean removal | After cleanup, test agent removed from `agents.list[]`; test workspace directory deleted |

**Known limitations of this live test**:

1. **`memory-lancedb` not patched live.** The plugin's Zod schema requires a
   configured `embedding.apiKey` and the dev gateway here has embeddings
   disabled. The per-agent `dbPath` invariant is verified at the *shape* level
   offline (B12.10, B11.7). The live `config.patch` deliberately omits the
   `plugins.entries["memory-lancedb"]` subsection.

2. **Per-agent memory isolation is design intent, not runtime reality.**
   OpenClaw's `memory-lancedb` plugin currently treats `dbPath` as a single
   *global* setting — every agent shares one LanceDB file, and isolation is
   enforced at the collection level by filtering on `agentId`. The per-agent
   `dbPath` emitted by the Creator's `config.patch` is a forward-looking
   invariant that will become authoritative once the plugin supports
   per-agent paths.

3. **No LLM is driving the Creator Agent here.** B12 validates that the
   config.patch body Person B's helpers produce is accepted by a live
   gateway. It does not test whether an actual LLM running the Creator
   Agent would produce the same patch. See `B13. Creator Agent TRUE E2E`
   for the forward-looking live-LLM harness.

4. **`netsuite-test` MCP server is a placeholder.** The script registers
   `mcp.servers["netsuite-test"]` with `command: "npx"`,
   `args: ["@sentura/mcp-netsuite"]` — that npm package does not exist yet.
   Config validation accepts it because `mcp.servers` does not try to
   spawn processes at validation time. Actual MCP server packages are the
   MCP Builder Agent's (Smith's) deliverable.

---
