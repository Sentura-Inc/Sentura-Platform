#!/usr/bin/env bash
set -euo pipefail

# Sentura Platform Setup (macOS / Linux)
# Run AFTER `pnpm openclaw onboard` to register Sentura meta-agents.
# Idempotent — safe to re-run.
#
# Supported platforms: macOS (darwin), Linux (including WSL2)
# For Windows (native PowerShell), use: scripts/sentura-setup.ps1

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OPENCLAW_DIR="$PROJECT_ROOT/openclaw"
OPENCLAW_STATE="${OPENCLAW_HOME:-$HOME/.openclaw}"
OPENCLAW_CONFIG="$OPENCLAW_STATE/openclaw.json"
WORKSPACE_BASE="$OPENCLAW_STATE/workspace"

# OpenClaw CLI must run from within the openclaw/ directory (build scripts resolve paths from CWD)
openclaw_cli() {
  (cd "$OPENCLAW_DIR" && node scripts/run-node.mjs "$@")
}

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${BLUE}[sentura]${NC} $*"; }
ok()    { echo -e "${GREEN}[sentura]${NC} $*"; }
warn()  { echo -e "${YELLOW}[sentura]${NC} $*"; }
err()   { echo -e "${RED}[sentura]${NC} $*" >&2; }

# --- Platform detection ---

PLATFORM="$(uname -s)"
case "$PLATFORM" in
  Linux*)  log "Platform: Linux" ;;
  Darwin*) log "Platform: macOS" ;;
  MINGW*|MSYS*|CYGWIN*)
    err "This script is not designed for Windows Git Bash / MSYS / Cygwin."
    err "Use the PowerShell script instead:  .\\scripts\\sentura-setup.ps1"
    exit 1
    ;;
  *)
    warn "Unknown platform: $PLATFORM — proceeding anyway"
    ;;
esac

# WSL detection
if [[ -f /proc/version ]] && grep -qi microsoft /proc/version 2>/dev/null; then
  log "WSL2 detected — running in Windows Subsystem for Linux"
fi

# --- Pre-flight checks ---

if ! command -v node &>/dev/null; then
  err "Node.js not found. Install Node.js 22+ before running this script."
  err "  Linux: https://nodejs.org/en/download/package-manager"
  err "  macOS: brew install node"
  exit 1
fi

NODE_MAJOR="$(node -e 'console.log(process.versions.node.split(".")[0])')"
if [[ "$NODE_MAJOR" -lt 22 ]]; then
  warn "Node.js v$(node --version) detected — OpenClaw requires v22+. Things may break."
fi

if [[ ! -f "$OPENCLAW_CONFIG" ]]; then
  err "OpenClaw config not found at $OPENCLAW_CONFIG"
  err "Run 'cd openclaw && pnpm openclaw onboard' first."
  exit 1
fi

if [[ ! -d "$OPENCLAW_DIR/src" ]]; then
  err "OpenClaw source not found at $OPENCLAW_DIR/src"
  err "Ensure the openclaw/ directory is present (git submodule or local clone)."
  exit 1
fi

log "OpenClaw config found at $OPENCLAW_CONFIG"
log "Workspace base: $WORKSPACE_BASE"

# Prefer a meta-agent model that the local auth store can actually run.
# Fresh installs often have only DeepSeek configured; hard-coding
# openai/gpt-5.4 makes Forge fail before it can even reach the browser tool.
resolve_meta_agent_model() {
  OPENCLAW_STATE="$OPENCLAW_STATE" OPENCLAW_CONFIG="$OPENCLAW_CONFIG" node <<'NODE_EOF'
const fs = require("fs");

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

const explicitModel = process.env.SENTURA_META_AGENT_MODEL?.trim();
if (explicitModel && explicitModel.includes("/")) {
  process.stdout.write(explicitModel);
  process.exit(0);
}

const openAiApiKey = process.env.OPENAI_API_KEY?.trim();
if (openAiApiKey) {
  process.stdout.write("openai/gpt-5.5");
  process.exit(0);
}

const stateDir = process.env.OPENCLAW_STATE;
const configPath = process.env.OPENCLAW_CONFIG;
const authProfiles = readJson(`${stateDir}/agents/main/agent/auth-profiles.json`);
const profileIds = authProfiles?.profiles && typeof authProfiles.profiles === "object"
  ? Object.keys(authProfiles.profiles)
  : [];

if (profileIds.some((id) => id.startsWith("openai:"))) {
  process.stdout.write("openai/gpt-5.5");
  process.exit(0);
}

if (profileIds.some((id) => id.startsWith("deepseek:"))) {
  process.stdout.write("deepseek/deepseek-reasoner");
  process.exit(0);
}

const config = readJson(configPath);
const primary = config?.agents?.defaults?.model?.primary;
if (typeof primary === "string" && primary.includes("/")) {
  process.stdout.write(primary);
  process.exit(0);
}

process.stdout.write("openai/gpt-5.5");
NODE_EOF
}

META_AGENT_MODEL="$(resolve_meta_agent_model)"
log "Preferred meta-agent model: $META_AGENT_MODEL"

# --- Helper: copy workspace files ---

copy_workspace() {
  local agent_id="$1"
  local source_dir="$2"
  local target_dir="$WORKSPACE_BASE/$agent_id"

  if [[ ! -d "$source_dir" ]]; then
    warn "Source directory not found: $source_dir (skipping workspace copy for $agent_id)"
    return 1
  fi

  log "Copying workspace: $agent_id"
  mkdir -p "$target_dir"

  # Copy all markdown files and subdirectories
  for item in "$source_dir"/*; do
    if [[ -f "$item" ]]; then
      cp "$item" "$target_dir/"
    elif [[ -d "$item" ]]; then
      cp -r "$item" "$target_dir/"
    fi
  done

  ok "  → $target_dir"
}

# --- Helper: register agent via CLI ---

register_agent() {
  local agent_id="$1"
  local model="${2:-$META_AGENT_MODEL}"
  local workspace_dir="$WORKSPACE_BASE/$agent_id"

  log "Registering agent: $agent_id"

  # Check if agent already exists in the config file directly
  if node -e "
    const config = JSON.parse(require('fs').readFileSync('$OPENCLAW_CONFIG', 'utf8'));
    const found = (config.agents?.list || []).some(a => a.id === '$agent_id');
    process.exit(found ? 0 : 1);
  " 2>/dev/null; then
    warn "  Agent '$agent_id' already registered (skipping)"
    return 0
  fi

  openclaw_cli agents add "$agent_id" \
    --workspace "$workspace_dir" \
    --model "$model" \
    --non-interactive \
    2>&1 | while IFS= read -r line; do echo "  $line"; done

  ok "  → Agent '$agent_id' registered"
}

# --- Step 1: Ensure workspace base directory exists ---

log "Step 1: Ensuring workspace base directory..."
mkdir -p "$WORKSPACE_BASE"

# --- Step 2: Copy source-agent workspaces ---

log "Step 2: Copying source-agent workspace files..."

META_AGENTS=("creator" "tuner" "orchestrator" "mcp-builder" "data-scavenger")
CLIENT_DEMO_AGENTS=("zuolian-travel-concierge" "cbe-lead-discovery" "cbe-buyer-screening")
SOURCE_AGENTS=("${META_AGENTS[@]}" "${CLIENT_DEMO_AGENTS[@]}")
SENTURA_AGENTS_DIR="$PROJECT_ROOT/sentura/agents"

for agent in "${META_AGENTS[@]}"; do
  if [[ -d "$SENTURA_AGENTS_DIR/$agent" ]]; then
    copy_workspace "$agent" "$SENTURA_AGENTS_DIR/$agent"
  else
    warn "Meta-agent source not found: $SENTURA_AGENTS_DIR/$agent"
  fi
done

for agent in "${CLIENT_DEMO_AGENTS[@]}"; do
  if [[ -d "$SENTURA_AGENTS_DIR/$agent" ]]; then
    copy_workspace "$agent" "$SENTURA_AGENTS_DIR/$agent"
  else
    warn "Client-demo agent source not found: $SENTURA_AGENTS_DIR/$agent"
  fi
done

# Ensure Sentura-specific directories exist in every source-agent workspace
# (the copy_workspace helper only copies what's in source; these are runtime dirs)
log "Ensuring Sentura workspace directories (ekg/, memory/users/)..."
for agent in "${SOURCE_AGENTS[@]}"; do
  target="$WORKSPACE_BASE/$agent"
  if [[ -d "$target" ]]; then
    mkdir -p "$target/ekg/org" "$target/ekg/rules" "$target/ekg/assets" \
             "$target/ekg/workflows/experience-links" "$target/memory/users" \
             "$target/skills"
  fi
done
ok "Sentura workspace directories ensured."

# Mark each source-agent workspace as "bootstrap complete" for OpenClaw.
#
# WHY: OpenClaw (openclaw/src/agents/workspace.ts → resolveWorkspaceBootstrapStatus)
# treats a workspace as "bootstrap pending" while `BOOTSTRAP.md` exists on disk
# AND `.openclaw/workspace-state.json` does not have `setupCompletedAt` set. When a
# workspace is pending, the runtime injects a `[Bootstrap pending]` prefix into
# every turn's user prompt and, for non-primary runs (e.g. dashboard-spawned
# sessions), forces the agent into "limited" mode — which is why Forge refuses
# to deploy a new employee from the dashboard with "This run is still
# bootstrap-pending, so I should not claim the creator workspace is fully
# initialized or do the actual deployment from here."
#
# Sentura deliberately KEEPS BOOTSTRAP.md permanently in every agent workspace
# because it hosts the top-level `## Enterprise Context` section (org structure,
# key systems, MCP inventory, data-classification tiers, policies). That is the
# intentional Sentura convention and differs from OpenClaw's native convention
# where BOOTSTRAP.md is a one-time checklist the agent deletes after setup.
#
# To reconcile: after Sentura setup runs on the customer's machine, we stamp
# `setupCompletedAt` into `<workspace>/.openclaw/workspace-state.json`. That
# tells OpenClaw "this workspace's setup is already complete — do not
# self-limit" while still keeping BOOTSTRAP.md as the permanent Enterprise
# Context file.
#
# Idempotent: if `setupCompletedAt` is already set, we preserve the original
# timestamp (so the "first setup" timestamp survives re-runs of this script).
log "Stamping setupCompletedAt into source-agent workspace state..."
STATE_NOW="$(node -e 'process.stdout.write(new Date().toISOString())')"
for agent in "${SOURCE_AGENTS[@]}"; do
  target="$WORKSPACE_BASE/$agent"
  if [[ ! -d "$target" ]]; then
    continue
  fi
  state_dir="$target/.openclaw"
  state_file="$state_dir/workspace-state.json"
  mkdir -p "$state_dir"
  AGENT_ID="$agent" STATE_FILE="$state_file" STATE_NOW="$STATE_NOW" node <<'NODE_EOF'
    const fs = require("fs");
    const path = require("path");
    const { STATE_FILE, STATE_NOW, AGENT_ID } = process.env;
    let state = { version: 1 };
    try {
      const raw = fs.readFileSync(STATE_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        state = { ...parsed };
      }
    } catch (err) {
      if (err && err.code !== "ENOENT") {
        console.error(`  warn: could not read ${STATE_FILE} (${err.code ?? err.message}); recreating`);
      }
    }
    if (typeof state.version !== "number") state.version = 1;
    if (typeof state.setupCompletedAt === "string" && state.setupCompletedAt.trim().length > 0) {
      process.stdout.write(`  ${AGENT_ID}: already complete (${state.setupCompletedAt})\n`);
    } else {
      state.setupCompletedAt = STATE_NOW;
      fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n", "utf8");
      process.stdout.write(`  ${AGENT_ID}: stamped setupCompletedAt=${STATE_NOW}\n`);
    }
NODE_EOF
done
ok "Source-agent workspaces marked as bootstrap-complete."

# --- Step 3: Register source agents ---

log "Step 3: Registering source agents with OpenClaw..."

for agent in "${SOURCE_AGENTS[@]}"; do
  if [[ -d "$WORKSPACE_BASE/$agent" ]]; then
    register_agent "$agent"
  else
    warn "Workspace not found for $agent — skipping registration"
  fi
done

# --- Step 4: Apply advanced config (tools, bindings) via direct JSON patch ---

log "Step 4: Applying Sentura agent configuration..."

# Set agents.defaults.workspace via direct config file patch
node -e "
const fs = require('fs');
const configPath = '$OPENCLAW_CONFIG';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
if (!config.agents) config.agents = {};
if (!config.agents.defaults) config.agents.defaults = {};
if (config.agents.defaults.workspace !== '~/.openclaw/workspace') {
  config.agents.defaults.workspace = '~/.openclaw/workspace';
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log('  Set agents.defaults.workspace = ~/.openclaw/workspace');
} else {
  console.log('  agents.defaults.workspace already set');
}
"

# Apply per-agent tool overrides by patching the config JSON directly.
# The CLI's `config set` doesn't support array-element addressing like
# agents.list[id=creator].tools, so we use node to patch the file.
SENTURA_META_AGENT_MODEL="$META_AGENT_MODEL" OPENCLAW_STATE="$OPENCLAW_STATE" node -e "
const fs = require('fs');
const path = require('path');
const configPath = '$OPENCLAW_CONFIG';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const preferredModel = process.env.SENTURA_META_AGENT_MODEL || 'openai/gpt-5.5';
const openClawState = process.env.OPENCLAW_STATE || '';
config.agents = config.agents || {};
config.agents.defaults = config.agents.defaults || {};
config.agents.defaults.models = config.agents.defaults.models || {};

function readDotEnvFile(filePath) {
  const entries = {};
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
      if (!match) continue;
      let value = match[2] ?? '';
      if (
        (value.startsWith('\"') && value.endsWith('\"')) ||
        (value.startsWith(\"'\") && value.endsWith(\"'\"))
      ) {
        value = value.slice(1, -1);
      }
      entries[match[1]] = value;
    }
  } catch (_) {}
  return entries;
}

const setupDotEnv = openClawState ? readDotEnvFile(path.join(openClawState, '.env')) : {};
const setupEnv = { ...setupDotEnv, ...process.env };
function hasSetupEnv(name) {
  return typeof setupEnv[name] === 'string' && setupEnv[name].trim().length > 0;
}
function setupEnvValue(name, fallback) {
  return hasSetupEnv(name) ? setupEnv[name].trim() : fallback;
}
function setupEnvNumber(name, fallback) {
  const parsed = Number(setupEnvValue(name, String(fallback)));
  return Number.isFinite(parsed) ? parsed : fallback;
}
function envRef(name) {
  return '$' + '{' + name + '}';
}
function buildCrossBorderIntelEnv() {
  const env = {};
  for (const name of [
    'COMPANIES_HOUSE_API_KEY',
    'ABSTRACT_API_KEY',
    'HUNTER_API_KEY',
    'IMPORTYETI_API_KEY',
    // Optional adapters not required by the default Phase-1 customer setup.
    'OPENCORPORATES_API_KEY',
    'VOLZA_API_KEY',
  ]) {
    if (hasSetupEnv(name)) {
      env[name] = envRef(name);
    }
  }
  env.SEC_USER_AGENT = setupEnvValue(
    'SEC_USER_AGENT',
    'SenturaCrossBorderIntel/0.1 contact=ops@example.invalid',
  );
  env.CBE_ENABLE_PAID_TRADE_DATA = setupEnvValue('CBE_ENABLE_PAID_TRADE_DATA', 'false');
  env.CBE_MAX_PAID_SPEND_USD = setupEnvValue('CBE_MAX_PAID_SPEND_USD', '0');
  env.CBE_INTEL_REQUEST_TIMEOUT_MS = setupEnvValue('CBE_INTEL_REQUEST_TIMEOUT_MS', '30000');
  return env;
}

function ensurePreferredModelAllowlistEntry(modelRef) {
  if (typeof modelRef !== 'string' || !modelRef.includes('/')) {
    return;
  }
  const existing = config.agents.defaults.models[modelRef];
  const [providerId, modelId] = modelRef.split('/', 2);
  const entry =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...existing }
      : {};
  if (entry.alias === undefined) {
    if (providerId === 'openai') entry.alias = 'GPT';
    if (providerId === 'openai-codex') entry.alias = 'Codex';
    if (providerId === 'deepseek' && modelId === 'deepseek-chat') entry.alias = 'DeepSeek';
  }
  config.agents.defaults.models[modelRef] = entry;
  if (!existing) {
    console.log('  Allowlisted preferred model: ' + modelRef);
  }
}

ensurePreferredModelAllowlistEntry(preferredModel);
// NOTE: we deliberately do NOT set \`agent.skills\` here.
// In OpenClaw, \`agents.list[].skills\` is a name filter (array of skill
// names), not a path glob. Writing a path like \`{workspace}/skills/*\`
// resulted in zero matching skill names, so every skill was silenced in
// the sandbox. Omitting the field falls back to the default discovery
// path (\`workspace/skills/*/SKILL.md\`), which is what we want.
// IMPORTANT: 'sentura_agents_manage' is the tool Forge uses to materialize
// new-employee workspace subfiles (skills/, ekg/, memory/users/) on the
// HOST filesystem. fs_write cannot target /workspace/.openclaw/workspace/*
// (that path is read-only in the sandbox), and gateway.agents.files.set
// only covers the eight native workspace files. Without this entry in
// alsoAllow the Creator's employee-deployment skill is unexecutable.
//
// HARD DENY of 'write', 'edit', 'apply_patch', 'exec': the 'coding'
// profile ships these built-in filesystem mutation tools AND shell access.
// Observed Forge runs defaulted to 'write' with /workspace/generated/...
// paths (which are read-only in the sandbox) despite every skill telling
// it to use sentura_agents_manage. Removing these four tools from the
// resolved tool set at the policy layer is the only reliable way to force
// Forge through the correct path. 'exec' was added to the deny list on
// 2026-04-18 after Forge was observed using exec + python3 heredocs to
// write employee files to the host repo (Sentura-Platform/workspaces/)
// and then git-committing them, bypassing both sentura_agents_manage and
// config.patch entirely.
//
// SANDBOX TOOL-POLICY FIX (Round 20, 2026-04-19)
// ------------------------------------------------------------------
// OpenClaw's non-main sandbox applies a SECOND tool filter *after* the
// agent-level tools.allow/alsoAllow step. It is implemented in
// openclaw/src/agents/sandbox/constants.ts:
//   - DEFAULT_TOOL_ALLOW: hardcoded narrow set (exec/read/write/edit/
//     apply_patch/process/image/sessions_*/session_status/subagents).
//   - DEFAULT_TOOL_DENY:  hardcoded (gateway, browser, canvas, cron,
//     nodes + every channel id).
// Agent-level tools.alsoAllow does NOT bleed into the sandbox filter.
// Any plugin tool (sentura_agents_manage, gateway, browser, pdf, canvas,
// cron, memory_*, update_plan, image_generate, video_generate, web_fetch,
// web_search, sentura_rbac_manage, sentura_audit_query) is silently
// stripped at the sandbox stage unless it also appears in
// tools.sandbox.tools.alsoAllow.
//
// Symptom when this block is missing: the dashboard chat.send path
// (which goes through the sandbox) hands the meta-agent a 7-tool toolset
// and the model refuses to call sentura_agents_manage. The CLI
// 'openclaw agent' path is NOT affected because its tool resolution runs
// before the sandbox filter -- this is the CLI-vs-dashboard divergence
// that blocked deploys for a full day.
//
// Fix: every Sentura meta-agent mirrors its agent-level alsoAllow into
// tools.sandbox.tools.alsoAllow. Channel-like entries (gateway/browser/
// canvas/pdf/cron) are auto-removed from DEFAULT_TOOL_DENY by
// filterDefaultDenyForExplicitAllows -- no sandbox deny-list edit needed.
// See docs/SETUP.md § 'Sandbox tool-policy filter' and
// docs/OPENCLAW.md § 'Sandbox tool-policy (dashboard path)' for details.
const creatorSandboxAlsoAllow = [
  'gateway','sessions_send','web_search','web_fetch','browser','pdf','canvas',
  'sentura_agents_manage','sentura_rbac_manage','sentura_audit_query',
  'memory_search','memory_get','cron','update_plan','image_generate','video_generate'
];
const tunerSandboxAlsoAllow = [
  'gateway','sessions_send','web_search','web_fetch',
  'sentura_agents_manage','sentura_approval_request','sentura_rbac_manage','sentura_audit_query',
  'memory_search','memory_get','update_plan','pdf','canvas','cron'
];
const tunerToolsDeny = ['read','write','edit','apply_patch'];
const orchestratorSandboxAlsoAllow = [
  'sessions_send','sessions_spawn','subagents','web_search','web_fetch',
  'memory_search','memory_get','update_plan','cron'
];
const mcpBuilderSandboxAlsoAllow = [
  'gateway','sessions_send','web_search','web_fetch','browser','pdf','canvas',
  'memory_search','memory_get','update_plan','cron'
];
const dataScavengerSandboxAlsoAllow = [
  'pdf','web_fetch','web_search',
  'sentura_agents_manage','memory_search','memory_get',
  'canvas','cron','update_plan'
];
const zuolianToolAllow = ['group:plugins','web_search','web_fetch'];
const zuolianSandboxAllow = ['dida-travel-demo__*','web_search','web_fetch'];
const zuolianModels = {
  [preferredModel]: { agentRuntime: { id: 'openclaw' } }
};
const zuolianToolsDeny = [
  'agents_list','canvas','cron','create_goal','exec','gateway','get_goal',
  'image','image_generate','memory_get','memory_search','message','nodes','pdf',
  'process','read','session_status','sessions_history','sessions_list','sessions_send',
  'sessions_spawn','sessions_yield','skill_workshop','subagents','tts','update_goal',
  'update_plan','video_generate','edit','apply_patch','write'
];
const cbeLeadToolAllow = ['web_search','web_fetch','cron','group:plugins'];
const cbeLeadSandboxAllow = ['web_search','web_fetch','cron','cross-border-intel__*'];
const cbeLeadModels = {
  [preferredModel]: { agentRuntime: { id: 'openclaw' } }
};
const cbeLeadToolsDeny = [
  'agents_list','browser','canvas','create_goal','exec','gateway','get_goal',
  'image','image_generate','memory_get','memory_search','message','nodes','pdf',
  'process','read','session_status','sessions_history','sessions_list','sessions_send',
  'sessions_spawn','sessions_yield','skill_workshop','subagents','tts','update_goal',
  'update_plan','video_generate','edit','apply_patch','write'
];
const cbeScreeningToolAllow = ['web_search','web_fetch','memory_search','memory_get','group:plugins'];
const cbeScreeningSandboxAllow = ['web_search','web_fetch','memory_search','memory_get','cross-border-intel__*'];
const cbeScreeningModels = {
  [preferredModel]: { agentRuntime: { id: 'openclaw' } }
};
const cbeScreeningToolsDeny = [
  'agents_list','browser','canvas','create_goal','cron','exec','gateway','get_goal',
  'image','image_generate','message','nodes','pdf','process','read','session_status',
  'sessions_history','sessions_list','sessions_send','sessions_spawn','sessions_yield',
  'skill_workshop','subagents','tts','update_goal','update_plan','video_generate',
  'edit','apply_patch','write'
];

const overrides = {
  creator:         { name: 'Forge',     model: preferredModel, tools: { profile: 'coding',  alsoAllow: ['gateway','sessions_send','sessions_spawn','web_search','web_fetch','browser','pdf','canvas','sentura_agents_manage','sentura_rbac_manage','sentura_audit_query'], deny: ['write','edit','apply_patch','exec'], sandbox: { tools: { alsoAllow: creatorSandboxAlsoAllow } } }, sandbox: { mode: 'non-main' }, runtime: { type: 'embedded' } },
  tuner:           { name: 'Refine',    model: preferredModel, tools: { profile: 'coding',  alsoAllow: ['gateway','sessions_send','web_search','web_fetch','sentura_agents_manage','sentura_approval_request','memory_search','memory_get','update_plan'], deny: tunerToolsDeny, sandbox: { tools: { alsoAllow: tunerSandboxAlsoAllow, deny: tunerToolsDeny } } }, sandbox: { mode: 'non-main' }, runtime: { type: 'embedded' } },
  orchestrator:    { name: 'Conductor', model: preferredModel, tools: { profile: 'minimal', alsoAllow: ['sessions_send','sessions_spawn','web_search'], sandbox: { tools: { alsoAllow: orchestratorSandboxAlsoAllow } } }, sandbox: { mode: 'non-main' }, runtime: { type: 'embedded' } },
  'mcp-builder':   { name: 'Socket',    model: preferredModel, tools: { profile: 'coding',  alsoAllow: ['gateway','sessions_send','web_search','web_fetch','browser','pdf'], deny: ['sessions_spawn','subagents','sessions_yield'], sandbox: { tools: { alsoAllow: mcpBuilderSandboxAlsoAllow } } }, sandbox: { mode: 'non-main' }, runtime: { type: 'embedded' } },
  'data-scavenger':{ name: 'Scout',     model: preferredModel, tools: { profile: 'coding',  alsoAllow: ['pdf','web_fetch','web_search','sentura_agents_manage','memory_search'], deny: ['sessions_spawn','subagents','sessions_yield','browser','exec','write','edit','apply_patch'], sandbox: { tools: { alsoAllow: dataScavengerSandboxAlsoAllow } } }, sandbox: { mode: 'non-main', workspaceAccess: 'rw' }, runtime: { type: 'embedded' } },
  'zuolian-travel-concierge': { name: '座联出行客服', model: preferredModel, models: zuolianModels, tools: { profile: 'coding', allow: zuolianToolAllow, deny: zuolianToolsDeny, sandbox: { tools: { allow: zuolianSandboxAllow } } }, sandbox: { mode: 'non-main' }, runtime: { type: 'embedded' }, params: { role: 'Sitlink AI travel customer-support employee', language: 'zh-CN', demoScope: 'Phase 1 fixture-first web/chat demo with web research supplement' } },
  'cbe-lead-discovery': { name: '跨境营销获客员工', model: preferredModel, models: cbeLeadModels, tools: { profile: 'minimal', allow: cbeLeadToolAllow, deny: cbeLeadToolsDeny, sandbox: { tools: { allow: cbeLeadSandboxAllow } } }, sandbox: { mode: 'non-main' }, runtime: { type: 'embedded' }, params: { role: 'Cross-border mobile-accessory Marketing Acquisition employee', language: 'zh-CN', tenant: 'cross-border-ecommerce', demoScope: 'Phase 1 public-search lead discovery with typed Screening handoff preview' } },
  'cbe-buyer-screening': { name: '跨境筛选背调员工', model: preferredModel, models: cbeScreeningModels, tools: { profile: 'minimal', allow: cbeScreeningToolAllow, deny: cbeScreeningToolsDeny, sandbox: { tools: { allow: cbeScreeningSandboxAllow } } }, sandbox: { mode: 'non-main' }, runtime: { type: 'embedded' }, params: { role: 'Cross-border mobile-accessory Screening and Background Investigation employee', language: 'zh-CN', tenant: 'cross-border-ecommerce', demoScope: 'Phase 1 low-cost live buyer background investigation with contextual scoring' } },
};

for (const agent of (config.agents?.list || [])) {
  if (overrides[agent.id]) {
    Object.assign(agent, overrides[agent.id]);
    // Remove any stale glob-style skills filter written by an earlier
    // version of this script. The correct value is \"unset\" (undefined).
    if (Array.isArray(agent.skills) && agent.skills.some((s) => typeof s === 'string' && s.includes('/'))) {
      delete agent.skills;
    }
  }
}

config.bindings = Array.isArray(config.bindings) ? config.bindings : [];
if (!config.bindings.some((b) => b && b.agentId === 'zuolian-travel-concierge' && b.match?.channel === 'webchat')) {
  config.bindings.push({
    agentId: 'zuolian-travel-concierge',
    match: { channel: 'webchat', peer: { kind: 'dm', id: '*' } },
  });
  console.log('  Added webchat binding for zuolian-travel-concierge');
}
if (!config.bindings.some((b) => b && b.agentId === 'cbe-lead-discovery' && b.match?.channel === 'webchat')) {
  config.bindings.push({
    agentId: 'cbe-lead-discovery',
    match: { channel: 'webchat', peer: { kind: 'dm', id: '*' } },
  });
  console.log('  Added webchat binding for cbe-lead-discovery');
}
if (!config.bindings.some((b) => b && b.agentId === 'cbe-buyer-screening' && b.match?.channel === 'webchat')) {
  config.bindings.push({
    agentId: 'cbe-buyer-screening',
    match: { channel: 'webchat', peer: { kind: 'dm', id: '*' } },
  });
  console.log('  Added webchat binding for cbe-buyer-screening');
}

config.mcp = config.mcp || {};
config.mcp.servers = config.mcp.servers || {};
config.mcp.servers['dida-travel-demo'] = {
  command: 'node',
  args: ['$PROJECT_ROOT/sentura/mcp-servers/dida-travel-demo/dist/index.js'],
  cwd: '$PROJECT_ROOT',
  env: { DIDA_DEMO_MODE: 'fixture' },
};
config.mcp.servers['cross-border-intel'] = {
  command: 'node',
  args: ['$PROJECT_ROOT/sentura/mcp-servers/cross-border-intel/dist/index.js'],
  cwd: '$PROJECT_ROOT',
  env: buildCrossBorderIntelEnv(),
  requestTimeoutMs: setupEnvNumber('CBE_INTEL_REQUEST_TIMEOUT_MS', 30000),
};
console.log('  Added/updated MCP server: cross-border-intel');
if (hasSetupEnv('TAVILY_API_KEY')) {
  console.log('  Detected TAVILY_API_KEY for OpenClaw web_search and CBE Dashboard live search');
}

// Grant every local sender owner privileges so the webchat control UI can
// use owner-only tools (gateway/cron/nodes). Without this, Forge's 'gateway'
// tool is stripped by applyOwnerOnlyToolPolicy and it cannot call
// config.patch to register new employees. For a single-operator local dev
// setup, '*' is the canonical value (see command-auth.owner-default.test.ts).
// Production deployments should replace '*' with the explicit operator ID.
config.commands = config.commands || {};
if (!Array.isArray(config.commands.ownerAllowFrom) || config.commands.ownerAllowFrom.length === 0) {
  config.commands.ownerAllowFrom = ['*'];
  console.log('  Set commands.ownerAllowFrom = [\"*\"] (local-dev owner grant)');
} else if (!config.commands.ownerAllowFrom.includes('*')) {
  console.log('  commands.ownerAllowFrom already configured: ' + JSON.stringify(config.commands.ownerAllowFrom));
}

// Force exec tool to run on the gateway host. Without this setting,
// tools.exec.host defaults to 'auto', and when a sandbox is available
// (Forge runs in a non-main sandbox), any explicit request of
// host: 'gateway' is rejected with
//   exec host not allowed (requested gateway; configured host is auto; ...)
// (see openclaw/src/agents/bash-tools.exec-runtime.ts
//  isRequestedExecTargetAllowed). Forge's deployment skill and its
// self-diagnostic calls (for example, the openclaw gateway status probe) need
// gateway-host execution, so we pin the configured host to 'gateway'
// for local dev. This does NOT grant exec any additional capabilities;
// it only removes the ambiguous auto-routing rejection. Production
// deployments that want sandboxed exec should change this to
// 'sandbox' or drop the override.
config.tools = config.tools || {};
config.tools.exec = config.tools.exec || {};
if (config.tools.exec.host !== 'gateway') {
  config.tools.exec.host = 'gateway';
  console.log('  Set tools.exec.host = gateway (allow exec host override)');
}

// Enable the sandbox browser for non-main sessions. Week 3's live
// self-provisioning path runs from dashboard-created Creator sessions,
// which use target="sandbox" by default when Forge calls the browser tool.
// Without this flag, the exact A20 probe path fails with:
//   Sandbox browser is unavailable. Enable agents.defaults.sandbox.browser.enabled...
config.agents.defaults.sandbox = config.agents.defaults.sandbox || {};
config.agents.defaults.sandbox.browser = config.agents.defaults.sandbox.browser || {};
if (config.agents.defaults.sandbox.browser.enabled !== true) {
  config.agents.defaults.sandbox.browser.enabled = true;
  console.log('  Enabled agents.defaults.sandbox.browser.enabled = true');
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('  Patched agent configs: ' + Object.keys(overrides).join(', '));
"

ok "Agent configuration applied."

# --- Step 4b: Apply default tenancy to every registered agent ---
#
# Sentura's multi-tenancy model lives in `~/.openclaw/sentura-rbac/agent-tenancy.json`,
# NOT inside `agents.list[]` — we never mutate undocumented OpenClaw config
# fields. Every registered agent gets a record so downstream extensions
# (`sentura-cost`, `sentura-monitoring`) can attribute events without falling
# back to "unknown tenant". Single-tenant deployments use
# `tenantId="default"`, `departmentId=null`; Week 5+ multi-department wiring
# updates the records via `sentura.rbac.tenancy.set`.
#
# Idempotent: existing records are preserved; only agents missing a record
# receive the default.

log "Step 4b: Applying default tenancy to registered agents..."

RBAC_DATA_DIR_FOR_TENANCY="$OPENCLAW_STATE/sentura-rbac"
mkdir -p "$RBAC_DATA_DIR_FOR_TENANCY"

node -e "
const fs = require('fs');
const path = require('path');
const configPath = '$OPENCLAW_CONFIG';
const tenancyPath = path.join('$RBAC_DATA_DIR_FOR_TENANCY', 'agent-tenancy.json');

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const agents = (config.agents && config.agents.list) || [];
if (agents.length === 0) {
  console.log('  No registered agents — skipping tenancy seed.');
  process.exit(0);
}

let records = [];
try {
  records = JSON.parse(fs.readFileSync(tenancyPath, 'utf8'));
} catch (_) {}

const seen = new Set(records.map((r) => r.agentId));
const now = new Date().toISOString();
let added = 0;
for (const agent of agents) {
  if (!seen.has(agent.id)) {
    records.push({
      agentId: agent.id,
      tenantId: 'default',
      departmentId: null,
      updatedAt: now,
    });
    added++;
  }
}

if (added > 0) {
  records.sort((a, b) => a.agentId.localeCompare(b.agentId));
  fs.writeFileSync(tenancyPath, JSON.stringify(records, null, 2));
  console.log('  Seeded default tenancy for ' + added + ' agent(s)');
} else {
  console.log('  All agents already have tenancy records');
}
"

ok "Agent tenancy applied."

# --- Step 5: Configure per-agent LanceDB memory isolation ---

log "Step 5: Configuring per-agent LanceDB memory isolation..."

node -e "
const fs = require('fs');
const configPath = '$OPENCLAW_CONFIG';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

let updated = 0;
for (const agent of (config.agents?.list || [])) {
  if (!agent.params) agent.params = {};
  if (!agent.params.memoryDbPath) {
    agent.params.memoryDbPath = '~/.openclaw/memory/' + agent.id + '/lancedb';
    updated++;
  }
}

if (updated > 0) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log('  Set per-agent memoryDbPath for ' + updated + ' agent(s)');
} else {
  console.log('  All agents already have memoryDbPath configured');
}
"

ok "Per-agent LanceDB isolation configured."

# --- Step 6: Configure gateway for Sentura Dashboard ---

log "Step 6: Configuring gateway for Sentura Dashboard (controlUi.allowInsecureAuth)..."

node -e "
const fs = require('fs');
const configPath = '$OPENCLAW_CONFIG';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

if (!config.gateway) config.gateway = {};
if (!config.gateway.controlUi) config.gateway.controlUi = {};
if (config.gateway.controlUi.allowInsecureAuth !== true) {
  config.gateway.controlUi.allowInsecureAuth = true;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log('  Set gateway.controlUi.allowInsecureAuth = true');
} else {
  console.log('  gateway.controlUi.allowInsecureAuth already set');
}
"

ok "Gateway configured for local dashboard access."

# --- Step 7: Install Sentura internal hooks ---

log "Step 7: Installing Sentura internal hooks..."

HOOKS_DIR="$OPENCLAW_STATE/hooks"
mkdir -p "$HOOKS_DIR"

SENTURA_HOOKS=("sentura-bootstrap" "sentura-sandbox-seed")

for hook_name in "${SENTURA_HOOKS[@]}"; do
  hook_source="$PROJECT_ROOT/sentura/hooks/$hook_name"
  hook_target="$HOOKS_DIR/$hook_name"

  if [[ -d "$hook_source" ]]; then
    rm -rf "$hook_target"
    cp -r "$hook_source" "$hook_target"
    ok "  → $hook_name installed at $hook_target"
  else
    warn "  Hook source not found: $hook_source — skipping"
  fi
done

# Enable all Sentura hooks in the live OpenClaw config.
node -e "
const fs = require('fs');
const configPath = '$OPENCLAW_CONFIG';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

if (!config.hooks) config.hooks = {};
if (!config.hooks.internal) config.hooks.internal = {};
config.hooks.internal.enabled = true;
if (!config.hooks.internal.entries) config.hooks.internal.entries = {};

const names = ['sentura-bootstrap', 'sentura-sandbox-seed'];
for (const name of names) {
  const current = config.hooks.internal.entries[name];
  config.hooks.internal.entries[name] = { ...(current || {}), enabled: true };
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('  Hooks enabled in config: ' + names.join(', '));
"

ok "Sentura hooks enabled."

# --- Step 7a: Wire Sentura extensions into OpenClaw ---
#
# Sentura extensions live in-repo under `sentura/extensions/<name>/`. They
# are NOT installed into ~/.openclaw/extensions (that directory is for
# `openclaw install`-style packaged plugins). Instead we expose each
# extension directory to OpenClaw's plugin discovery via `plugins.load.paths`
# and enable the extension id in `plugins.entries`.
#
# This is the only way `sentura.agents.writeSubfile` (and the
# `sentura_agents_manage` tool on the Creator) can be registered with the
# gateway. Without this step the Creator's employee-deployment skill has no
# way to write skills/, ekg/, or memory/users/ files onto the host
# workspace of a new employee — `agents.files.set` only covers the eight
# native files, and `fs_write` cannot escape the sandbox.

log "Step 7a: Wiring Sentura extensions (plugins.load.paths + plugins.entries)..."

SENTURA_EXTENSIONS_DIR="$PROJECT_ROOT/sentura/extensions"
# Extensions to wire in. Only those that actually exist on disk AND have
# both openclaw.plugin.json + index.ts are added — missing extensions are
# reported as warnings so Person A/D can see what's pending.
SENTURA_EXT_IDS=("sentura-agents" "sentura-rbac" "sentura-audit" "sentura-approval" "sentura-provisioner" "sentura-experience-extraction" "sentura-memory-lancedb" "sentura-cost" "sentura-monitoring")

# Build a newline-separated list of "<id>|<absolute-dir>" pairs for the
# Node patcher below. We only include extensions that have a manifest AND
# an index.ts; everything else is logged and skipped so a half-scaffolded
# extension never silently wedges the loader.
SENTURA_EXT_TUPLES=""
for ext_id in "${SENTURA_EXT_IDS[@]}"; do
  ext_dir="$SENTURA_EXTENSIONS_DIR/$ext_id"
  if [[ -f "$ext_dir/openclaw.plugin.json" && -f "$ext_dir/index.ts" ]]; then
    SENTURA_EXT_TUPLES+="$ext_id|$ext_dir"$'\n'
    ok "  → $ext_id present at $ext_dir"
  else
    warn "  ✗ $ext_id missing (expected $ext_dir/openclaw.plugin.json + index.ts) — skipping"
  fi
done

if [[ -n "$SENTURA_EXT_TUPLES" ]]; then
  export SENTURA_EXT_TUPLES
  OPENCLAW_CONFIG="$OPENCLAW_CONFIG" node <<'NODE_EOF'
const fs = require('fs');
const configPath = process.env.OPENCLAW_CONFIG;
const tuples = (process.env.SENTURA_EXT_TUPLES || '').split('\n').filter(Boolean);
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

if (!config.plugins) config.plugins = {};
if (!config.plugins.load) config.plugins.load = {};
if (!Array.isArray(config.plugins.load.paths)) config.plugins.load.paths = [];
if (!config.plugins.entries || typeof config.plugins.entries !== 'object') {
  config.plugins.entries = {};
}

let pathsChanged = 0;
let entriesChanged = 0;
for (const tuple of tuples) {
  const [id, dir] = tuple.split('|');
  if (!id || !dir) continue;
  if (!config.plugins.load.paths.includes(dir)) {
    config.plugins.load.paths.push(dir);
    pathsChanged++;
  }
  const current = config.plugins.entries[id] ?? {};
  if (current.enabled !== true) {
    config.plugins.entries[id] = { ...current, enabled: true };
    entriesChanged++;
  }
}

// If sentura-memory-lancedb is enabled, disable the upstream memory-lancedb
// plugin in the same write — both register `kind: "memory"`, so leaving the
// upstream one enabled would either double-register or non-deterministically
// pick one. Idempotent: only flips the flag when currently true.
let memoryLancedbDisabled = false;
let memoryLancedbEmbeddingSeeded = false;
const senturaMem = config.plugins.entries['sentura-memory-lancedb'];
if (senturaMem && senturaMem.enabled === true) {
  const upstream = config.plugins.entries['memory-lancedb'];
  if (upstream && upstream.enabled === true) {
    config.plugins.entries['memory-lancedb'] = { ...upstream, enabled: false };
    memoryLancedbDisabled = true;
  }
  // sentura-memory-lancedb's configSchema requires embedding.apiKey, so a
  // freshly-enabled entry without a config block fails ajv validation and
  // the plugin never boots ('sentura-memory-lancedb invalid config:
  // embedding: must have required property embedding'). Seed a default
  // embedding block on first install using the documented \${OPENAI_API_KEY}
  // env-interpolation token (per the plugin's own
  // uiHints.embedding.apiKey.help). The inner config nests under
  // entry.config — that is the path OpenClaw's plugin loader feeds into
  // the plugin's configSchema (validatePluginConfig({ value: entry.config })
  // in dist/loader-*.js). Idempotent: only seeds when config.embedding is
  // missing — operators can hand-edit either field afterward and re-runs
  // of setup will leave their values alone.
  const existingPluginConfig =
    senturaMem.config && typeof senturaMem.config === 'object'
      ? senturaMem.config
      : {};
  if (
    !existingPluginConfig.embedding ||
    typeof existingPluginConfig.embedding !== 'object'
  ) {
    config.plugins.entries['sentura-memory-lancedb'] = {
      ...senturaMem,
      config: {
        ...existingPluginConfig,
        embedding: {
          apiKey: '\${OPENAI_API_KEY}',
          model: 'text-embedding-3-small',
        },
      },
    };
    memoryLancedbEmbeddingSeeded = true;
  }
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('  plugins.load.paths additions: ' + pathsChanged);
console.log('  plugins.entries enable ops:   ' + entriesChanged);
console.log('  wired extensions:             ' + tuples.map((t) => t.split('|')[0]).join(', '));
if (memoryLancedbDisabled) {
  console.log('  disabled upstream memory-lancedb (sentura-memory-lancedb owns the memory slot)');
}
if (memoryLancedbEmbeddingSeeded) {
  console.log('  seeded sentura-memory-lancedb.embedding (\${OPENAI_API_KEY} + text-embedding-3-small)');
}
NODE_EOF
  ok "Sentura extensions wired."
else
  warn "  No Sentura extensions found on disk — plugins.load.paths left unchanged."
fi

# --- Step 7b: Clear stale sandboxes so sentura-sandbox-seed gets a clean slate ---
#
# Background: OpenClaw's ensureSandboxWorkspace only seeds 7 files on FIRST
# boot and skips re-seeding forever after (via `fs.access(dest)`). If a
# sandbox was created before the sentura-sandbox-seed hook existed, its
# BOOTSTRAP.md is a 700-byte default stub that the hook will still recognize
# and replace, but its skills/ directory is empty and its AGENTS.md/SOUL.md
# may be outdated. Wiping the sandbox directory forces OpenClaw to recreate
# it from the current host workspace on next agent boot.
#
# We only clean sandboxes for Sentura meta-agents — other agents are left
# alone.

log "Step 7b: Clearing stale meta-agent sandboxes (forces clean re-seed)..."

SANDBOX_ROOT="$OPENCLAW_STATE/sandboxes"
if [[ -d "$SANDBOX_ROOT" ]]; then
  for agent in "${META_AGENTS[@]}"; do
    for dir in "$SANDBOX_ROOT"/agent-"$agent"-*; do
      [[ -d "$dir" ]] || continue
      rm -rf "$dir"
      ok "  → cleared stale sandbox $dir"
    done
  done
else
  log "  No sandbox root at $SANDBOX_ROOT yet — nothing to clear."
fi

# --- Step 7b2: Ensure the diagnostic-event bus is on ---
#
# OpenClaw's agent-runner gates `model.usage` (and every other diagnostic
# event) behind `config.diagnostics.enabled === true` — see
# `openclaw/src/infra/diagnostic-events.ts:isDiagnosticsEnabled` and
# `openclaw/src/auto-reply/reply/agent-runner.ts:1414`. If this flag is
# unset, NO diagnostic events fire, even though Sentura's `sentura-cost`
# (and `sentura-monitoring`) extensions correctly subscribe to them on
# startup. The result is a `/cost` page that shows zero activity even
# while users are clearly chatting with employees.
#
# Step 7c (OTel wiring) used to be the only place that flipped
# `diagnostics.enabled = true` — but it only ran when
# OTEL_EXPORTER_OTLP_ENDPOINT was set. Operators without an OTel
# collector silently lost cost tracking. This step decouples the bus
# from the OTel sink: diagnostics are now ALWAYS on after setup.
# Idempotent — re-runs are no-ops once the flag is already true.

log "Step 7b2: Ensuring diagnostic-event bus is enabled..."

node -e "
const fs = require('fs');
const configPath = '$OPENCLAW_CONFIG';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
if (!config.diagnostics || typeof config.diagnostics !== 'object') {
  config.diagnostics = {};
}
if (config.diagnostics.enabled !== true) {
  config.diagnostics.enabled = true;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log('  Enabled diagnostics.enabled = true (cost + monitoring events will now fire)');
} else {
  console.log('  diagnostics.enabled already true (no change)');
}
"
ok "Diagnostic-event bus enabled."

# --- Step 7c: Wire OpenTelemetry via OpenClaw's diagnostics-otel extension ---
#
# Sentura piggybacks on the upstream `diagnostics-otel` plugin to export
# traces / metrics / logs via OTLP. We do NOT spin up a collector here —
# Docker is intentionally not a hard prereq. Operators who want a local
# collector can use the example compose snippet at
# `docs/otel/docker-compose.example.yml`.
#
# Behavior:
#   - If $OTEL_EXPORTER_OTLP_ENDPOINT is set, enable `diagnostics-otel` and
#     stamp `diagnostics.otel.enabled = true` + the endpoint into the live
#     OpenClaw config. Operators can override service name, sample rate,
#     and protocol via the standard OTEL_* env vars (the upstream plugin
#     reads them at start time).
#   - If $OTEL_EXPORTER_OTLP_ENDPOINT is unset, skip silently with a clear
#     "OTel disabled — set OTEL_EXPORTER_OTLP_ENDPOINT to enable" log line.
#     The plugin entry stays disabled so we don't leak traces to a
#     non-existent collector.
#
# Idempotent: re-runs flip nothing when the live config already matches
# the requested state.

log "Step 7c: Wiring OpenTelemetry (diagnostics-otel)..."

if [[ -n "${OTEL_EXPORTER_OTLP_ENDPOINT:-}" ]]; then
  export OTEL_EXPORTER_OTLP_ENDPOINT
  node -e "
const fs = require('fs');
const configPath = '$OPENCLAW_CONFIG';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const serviceName = process.env.OTEL_SERVICE_NAME || 'openclaw-sentura';

if (!config.plugins) config.plugins = {};
if (!config.plugins.entries || typeof config.plugins.entries !== 'object') {
  config.plugins.entries = {};
}
const current = config.plugins.entries['diagnostics-otel'] ?? {};
let entryFlipped = false;
if (current.enabled !== true) {
  config.plugins.entries['diagnostics-otel'] = { ...current, enabled: true };
  entryFlipped = true;
}

if (!config.diagnostics || typeof config.diagnostics !== 'object') {
  config.diagnostics = {};
}
let diagFlipped = false;
if (config.diagnostics.enabled !== true) {
  config.diagnostics.enabled = true;
  diagFlipped = true;
}
const otelBlock = config.diagnostics.otel ?? {};
const desiredOtel = {
  ...otelBlock,
  enabled: true,
  endpoint,
  serviceName: otelBlock.serviceName ?? serviceName,
};
let otelFlipped = false;
if (
  otelBlock.enabled !== true ||
  otelBlock.endpoint !== endpoint ||
  (otelBlock.serviceName ?? '') !== desiredOtel.serviceName
) {
  config.diagnostics.otel = desiredOtel;
  otelFlipped = true;
}

if (entryFlipped || diagFlipped || otelFlipped) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log('  Enabled diagnostics-otel (endpoint=' + endpoint + ', service=' + desiredOtel.serviceName + ')');
} else {
  console.log('  diagnostics-otel already configured (no change)');
}
"
  ok "OpenTelemetry wired."
else
  log "  OTel disabled — set OTEL_EXPORTER_OTLP_ENDPOINT to enable trace/metric export."
fi

# --- Step 8: Seed the first platform admin ---
#
# Customer-facing UX: the operator who just ran `sentura-setup.sh` should be
# able to log into the dashboard and drive the Creator/Tuner without ever
# opening a terminal again. That requires a real `platform_admin` user in
# the RBAC store — otherwise every guarded RPC (Creator deploy, audit query,
# RBAC management) runs in bootstrap mode (synthetic `__bootstrap__` user),
# which is only ever meant as an escape hatch for the FIRST upsert call.
#
# Bootstrap mode silently succeeds, so customers don't notice the gap until
# audit trails show `__bootstrap__` as the actor on every action. We close
# that gap here by seeding the admin directly into the RBAC store's JSON
# file. The gateway does NOT need to be running — `sentura-rbac` picks the
# record up on its next load because the store is file-backed.
#
# Inputs (priority order):
#   1. Env vars (non-interactive):  SENTURA_ADMIN_NAME, SENTURA_ADMIN_EMAIL
#   2. Interactive prompts if stdin is a TTY
#   3. Sensible defaults (`Platform Admin` / `admin@sentura.local`) otherwise
#
# Idempotent: if ANY user with role=platform_admin already exists, the seed
# step is skipped. The existing admin's token is still echoed into
# `sentura/dashboard/.env.local` (if that file lacks the keys) so re-runs
# after a dashboard reinstall still yield a working config.

log "Step 8: Seeding first platform admin (so no curl required)..."

RBAC_DATA_DIR="$OPENCLAW_STATE/sentura-rbac"
RBAC_USERS_FILE="$RBAC_DATA_DIR/users.json"
DASHBOARD_ENV_FILE="$PROJECT_ROOT/sentura/dashboard/.env.local"

mkdir -p "$RBAC_DATA_DIR"

# Decide whether a seed is needed. We read the file in node so we handle the
# "file missing" and "file exists but has no platform_admin" cases uniformly.
ADMIN_STATUS="$(node -e "
const fs = require('fs');
const p = '$RBAC_USERS_FILE';
let users = [];
try { users = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) {}
const admin = users.find((u) => u && u.role === 'platform_admin');
if (admin) {
  process.stdout.write('EXISTS\t' + admin.id + '\t' + admin.email + '\t' + admin.userToken);
} else {
  process.stdout.write('MISSING');
}
")"

if [[ "$ADMIN_STATUS" == EXISTS* ]]; then
  IFS=$'\t' read -r _ ADMIN_ID ADMIN_EMAIL ADMIN_TOKEN <<< "$ADMIN_STATUS"
  ok "  Platform admin already seeded: $ADMIN_EMAIL (id=$ADMIN_ID)"
  log "  Skipping seed step (re-runs are safe). Re-using existing credentials for the dashboard wiring below."
else
  # Resolve name/email from env vars, TTY prompts, or defaults.
  ADMIN_NAME="${SENTURA_ADMIN_NAME:-}"
  ADMIN_EMAIL="${SENTURA_ADMIN_EMAIL:-}"

  if [[ -z "$ADMIN_NAME" || -z "$ADMIN_EMAIL" ]]; then
    if [[ -t 0 && -z "${SENTURA_ADMIN_NONINTERACTIVE:-}" ]]; then
      log "  No SENTURA_ADMIN_* env vars set — prompting for the first admin's identity."
      log "  (Set SENTURA_ADMIN_NAME / SENTURA_ADMIN_EMAIL / SENTURA_ADMIN_NONINTERACTIVE=1 to skip the prompts next time.)"
      if [[ -z "$ADMIN_NAME" ]]; then
        default_name="$(id -F 2>/dev/null || getent passwd "$USER" 2>/dev/null | cut -d: -f5 | cut -d, -f1 || echo "")"
        default_name="${default_name:-Platform Admin}"
        read -r -p "  Admin full name [$default_name]: " ADMIN_NAME </dev/tty || ADMIN_NAME=""
        ADMIN_NAME="${ADMIN_NAME:-$default_name}"
      fi
      if [[ -z "$ADMIN_EMAIL" ]]; then
        default_email="admin@sentura.local"
        read -r -p "  Admin email [$default_email]: " ADMIN_EMAIL </dev/tty || ADMIN_EMAIL=""
        ADMIN_EMAIL="${ADMIN_EMAIL:-$default_email}"
      fi
    else
      ADMIN_NAME="${ADMIN_NAME:-Platform Admin}"
      ADMIN_EMAIL="${ADMIN_EMAIL:-admin@sentura.local}"
      log "  Non-interactive — using name=\"$ADMIN_NAME\", email=\"$ADMIN_EMAIL\"."
    fi
  fi

  # Very light validation — an unusable email here would make the dashboard
  # login screen awkward later, so we catch the obvious "contains @" case.
  if [[ "$ADMIN_EMAIL" != *"@"* ]]; then
    err "  Admin email must contain '@' — got: $ADMIN_EMAIL"
    exit 1
  fi

  # Atomic seed via node: generate UUIDv4 userToken, build the SenturaUser
  # record matching `sentura/extensions/sentura-rbac/src/types.ts`, write to
  # a .tmp file, rename into place. Keeps the store valid even if the process
  # is killed mid-write.
  export SENTURA_ADMIN_NAME="$ADMIN_NAME"
  export SENTURA_ADMIN_EMAIL="$ADMIN_EMAIL"
  SEED_RESULT="$(node -e "
const fs = require('fs');
const crypto = require('crypto');
const p = '$RBAC_USERS_FILE';
const name = process.env.SENTURA_ADMIN_NAME;
const email = process.env.SENTURA_ADMIN_EMAIL;
let users = [];
try { users = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) {}
const now = new Date().toISOString();
const shortId = crypto.randomBytes(4).toString('hex');
const user = {
  id: 'user-admin-' + shortId,
  email,
  name,
  role: 'platform_admin',
  userToken: crypto.randomUUID(),
  departmentIds: [],
  ownedEmployeeIds: [],
  createdAt: now,
  updatedAt: now,
  metadata: { seededBy: 'sentura-setup', seededAt: now },
};
// Collapse any non-admin duplicate of the same email so re-running with the
// same email (after manually deleting the admin) doesn't produce two entries.
users = users.filter((u) => u && u.email !== email);
users.push(user);
const tmp = p + '.tmp';
fs.writeFileSync(tmp, JSON.stringify(users, null, 2), 'utf8');
fs.renameSync(tmp, p);
process.stdout.write(user.id + '\t' + user.email + '\t' + user.userToken);
")"
  IFS=$'\t' read -r ADMIN_ID ADMIN_EMAIL ADMIN_TOKEN <<< "$SEED_RESULT"
  ok "  Seeded platform admin: $ADMIN_EMAIL"
  ok "  → id:    $ADMIN_ID"
  ok "  → token: $ADMIN_TOKEN"
fi

# --- Dashboard .env wiring ---
#
# The dashboard needs two new keys so it can call RBAC-guarded RPCs as the
# newly seeded admin (the gateway token alone only gets you transport-level
# auth; `actorId` / userToken is what the middleware checks against). We
# upsert just those two keys and leave any existing gateway config intact.

log "  Wiring dashboard .env.local with admin credentials + gateway auth..."

export SENTURA_ADMIN_USER_ID="$ADMIN_ID"
export SENTURA_ADMIN_USER_TOKEN="$ADMIN_TOKEN"
export SENTURA_DASHBOARD_ENV_FILE="$DASHBOARD_ENV_FILE"
export SENTURA_OPENCLAW_CONFIG="$OPENCLAW_CONFIG"

node -e "
const fs = require('fs');
const p = process.env.SENTURA_DASHBOARD_ENV_FILE;
const adminId = process.env.SENTURA_ADMIN_USER_ID;
const adminToken = process.env.SENTURA_ADMIN_USER_TOKEN;
const openclawConfigPath = process.env.SENTURA_OPENCLAW_CONFIG;

let body = '';
try { body = fs.readFileSync(p, 'utf8'); } catch (_) { body = ''; }

let gatewayToken = '';
try {
  const config = JSON.parse(fs.readFileSync(openclawConfigPath, 'utf8'));
  gatewayToken =
    typeof config?.gateway?.auth?.token === 'string' ? config.gateway.auth.token.trim() : '';
} catch (_) {
  gatewayToken = '';
}

function upsertLine(src, key, value, comment) {
  const re = new RegExp('^' + key.replace(/[.*+?^\${}()|[\\\\]\\\\\\\\]/g, '\\\\\$&') + '=.*$', 'm');
  const line = key + '=' + value;
  if (re.test(src)) return src.replace(re, line);
  const prefix = src.length && !src.endsWith('\n') ? '\n' : '';
  const block = (src.length ? '\n' : '') + (comment ? '# ' + comment + '\n' : '') + line + '\n';
  return src + prefix + block;
}

let next = body;
next = upsertLine(next, 'NEXT_PUBLIC_SENTURA_ADMIN_USER_ID', adminId,
  'Sentura platform admin user id (seeded by scripts/sentura-setup.sh, Step 8)');
next = upsertLine(next, 'NEXT_PUBLIC_SENTURA_ADMIN_TOKEN', adminToken,
  'Sentura platform admin userToken (sent as actorId on RBAC-guarded RPCs)');
if (gatewayToken) {
  next = upsertLine(next, 'NEXT_PUBLIC_GATEWAY_TOKEN', gatewayToken,
    'OpenClaw gateway token for local WebSocket auth (required when gateway.auth.mode=token)');
}
next = upsertLine(next, 'NEXT_PUBLIC_SENTURA_CREATOR_HANDSHAKE_ENABLED', 'true',
  'When true, dashboard auto-creates a welcome session for newly-deployed employees on /create. Set to false to disable.');

if (next !== body) {
  fs.mkdirSync(require('path').dirname(p), { recursive: true });
  fs.writeFileSync(p, next, 'utf8');
  console.log('  → updated ' + p);
} else {
  console.log('  → ' + p + ' already has all dashboard env keys');
}
"

ok "Dashboard admin credentials + gateway auth wired."
log "  The dashboard will pick these up on next \`pnpm dev\` (or restart). No curl step required."

# --- Step 9: Summary ---

echo ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok "Sentura setup complete!"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log "Meta-agents registered:"
for agent in "${META_AGENTS[@]}"; do
  if [[ -d "$WORKSPACE_BASE/$agent" ]]; then
    ok "  ✓ $agent → $WORKSPACE_BASE/$agent"
  else
    warn "  ✗ $agent (no workspace)"
  fi
done
echo ""
for hook_name in "${SENTURA_HOOKS[@]}"; do
  if [[ -d "$HOOKS_DIR/$hook_name" ]]; then
    case "$hook_name" in
      sentura-bootstrap)
        ok "Hook: $hook_name → per-user memory (memory/users/MEMORY_USER_{token}.md) injected into system prompt"
        ;;
      sentura-sandbox-seed)
        ok "Hook: $hook_name → host workspace (skills/, memory/, ekg/, custom BOOTSTRAP.md) re-seeded into sandbox on every bootstrap"
        ;;
      *)
        ok "Hook: $hook_name"
        ;;
    esac
  fi
done
echo ""
if [[ -n "${SENTURA_EXT_TUPLES:-}" ]]; then
  log "Sentura extensions enabled:"
  while IFS='|' read -r ext_id ext_dir; do
    [[ -z "$ext_id" ]] && continue
    ok "  ✓ $ext_id → $ext_dir"
  done <<< "$SENTURA_EXT_TUPLES"
  echo ""
fi
if [[ -n "${ADMIN_EMAIL:-}" && -n "${ADMIN_TOKEN:-}" ]]; then
  log "Platform admin:"
  ok  "  email:       $ADMIN_EMAIL"
  ok  "  id:          $ADMIN_ID"
  ok  "  userToken:   $ADMIN_TOKEN"
  log "  (token also written to sentura/dashboard/.env.local as NEXT_PUBLIC_SENTURA_ADMIN_TOKEN)"
  echo ""
fi
log "Next steps:"
log "  1. Start the gateway:  cd openclaw && pnpm gateway:watch"
log "  2. Start the dashboard: cd sentura/dashboard && pnpm dev"
log "  3. Open:               http://localhost:18789 (OpenClaw Control UI)"
log "                         http://localhost:3000  (Sentura dashboard)"
log "  4. Chat with Forge:    Send a message to create your first AI employee"
log "                         (runs as the seeded platform admin — not bootstrap mode)"
echo ""
