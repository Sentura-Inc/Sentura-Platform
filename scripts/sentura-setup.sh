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
  local model="${2:-openai/gpt-5.4}"
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

# --- Step 2: Copy meta-agent workspaces ---

log "Step 2: Copying meta-agent workspace files..."

META_AGENTS=("creator" "tuner" "orchestrator")
SENTURA_AGENTS_DIR="$PROJECT_ROOT/sentura/agents"

for agent in "${META_AGENTS[@]}"; do
  if [[ -d "$SENTURA_AGENTS_DIR/$agent" ]]; then
    copy_workspace "$agent" "$SENTURA_AGENTS_DIR/$agent"
  else
    warn "Meta-agent source not found: $SENTURA_AGENTS_DIR/$agent"
  fi
done

# Ensure Sentura-specific directories exist in every meta-agent workspace
# (the copy_workspace helper only copies what's in source; these are runtime dirs)
log "Ensuring Sentura workspace directories (ekg/, memory/users/)..."
for agent in "${META_AGENTS[@]}"; do
  target="$WORKSPACE_BASE/$agent"
  if [[ -d "$target" ]]; then
    mkdir -p "$target/ekg/org" "$target/ekg/rules" "$target/ekg/assets" \
             "$target/ekg/workflows/experience-links" "$target/memory/users" \
             "$target/skills"
  fi
done
ok "Sentura workspace directories ensured."

# --- Step 3: Register meta-agents ---

log "Step 3: Registering meta-agents with OpenClaw..."

for agent in "${META_AGENTS[@]}"; do
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
node -e "
const fs = require('fs');
const configPath = '$OPENCLAW_CONFIG';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// NOTE: we deliberately do NOT set \`agent.skills\` here.
// In OpenClaw, \`agents.list[].skills\` is a name filter (array of skill
// names), not a path glob. Writing a path like \`{workspace}/skills/*\`
// resulted in zero matching skill names, so every skill was silenced in
// the sandbox. Omitting the field falls back to the default discovery
// path (\`workspace/skills/*/SKILL.md\`), which is what we want.
const overrides = {
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
  // paths (which are read-only in
  // the sandbox) despite every skill telling it to use sentura_agents_manage.
  // Removing these four tools from the resolved tool set at the policy
  // layer is the only reliable way to force Forge through the correct path.
  // 'exec' was added to the deny list on 2026-04-18 after Forge was observed
  // using exec + python3 heredocs to write employee files to the host repo
  // (Sentura-Platform/workspaces/) and then git-committing them, bypassing
  // both sentura_agents_manage and config.patch entirely.
  creator:      { name: 'Forge',     tools: { profile: 'coding',  alsoAllow: ['gateway','sessions_send','sessions_spawn','web_search','web_fetch','browser','pdf','canvas','sentura_agents_manage','sentura_rbac_manage','sentura_audit_query'], deny: ['write','edit','apply_patch','exec'] }, sandbox: { mode: 'non-main' }, runtime: { type: 'embedded' } },
  tuner:        { name: 'Refine',    tools: { profile: 'coding',  alsoAllow: ['gateway','sessions_send','web_search','web_fetch'] }, sandbox: { mode: 'non-main' }, runtime: { type: 'embedded' } },
  orchestrator: { name: 'Conductor', tools: { profile: 'minimal', alsoAllow: ['sessions_send','sessions_spawn','web_search'] }, sandbox: { mode: 'non-main' }, runtime: { type: 'embedded' } },
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
// self-diagnostic calls (e.g. `openclaw gateway status`) need
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

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('  Patched agent configs: ' + Object.keys(overrides).join(', '));
"

ok "Agent configuration applied."

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
SENTURA_EXT_IDS=("sentura-agents" "sentura-rbac" "sentura-audit" "sentura-approval" "sentura-provisioner")

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
  node -e "
const fs = require('fs');
const configPath = '$OPENCLAW_CONFIG';
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

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('  plugins.load.paths additions: ' + pathsChanged);
console.log('  plugins.entries enable ops:   ' + entriesChanged);
console.log('  wired extensions:             ' + tuples.map((t) => t.split('|')[0]).join(', '));
"
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

# --- Step 8: Summary ---

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
log "Next steps:"
log "  1. Start the gateway:  cd openclaw && pnpm gateway:watch"
log "  2. Open the UI:        http://localhost:18789"
log "  3. Chat with Forge:    Send a message to create your first AI employee"
echo ""
