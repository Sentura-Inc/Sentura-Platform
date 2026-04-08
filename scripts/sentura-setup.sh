#!/usr/bin/env bash
set -euo pipefail

# Sentura Platform Setup
# Run AFTER `pnpm openclaw onboard` to register Sentura meta-agents.
# Idempotent — safe to re-run.

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

# --- Pre-flight checks ---

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
  local model="${2:-openai/gpt-4o}"
  local workspace_dir="$WORKSPACE_BASE/$agent_id"

  log "Registering agent: $agent_id"

  # Check if agent already exists
  if openclaw_cli agents list --json 2>/dev/null | grep -q "\"id\":\"$agent_id\"" 2>/dev/null; then
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

# Set agents.defaults.workspace via CLI (this path works reliably)
openclaw_cli config set "agents.defaults.workspace" --value "~/.openclaw/workspace" \
  2>&1 | while IFS= read -r line; do echo "  $line"; done || true

# Apply per-agent tool overrides by patching the config JSON directly.
# The CLI's `config set` doesn't support array-element addressing like
# agents.list[id=creator].tools, so we use node to patch the file.
node -e "
const fs = require('fs');
const configPath = '$OPENCLAW_CONFIG';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const overrides = {
  creator:      { name: 'Forge',     tools: { profile: 'coding',  alsoAllow: ['gateway','sessions_send','sessions_spawn','web_search','web_fetch','browser','pdf','canvas'] }, sandbox: { mode: 'non-main' }, runtime: { type: 'embedded' }, skills: ['$WORKSPACE_BASE/creator/skills/*'] },
  tuner:        { name: 'Refine',    tools: { profile: 'coding',  alsoAllow: ['gateway','sessions_send','web_search','web_fetch'] }, sandbox: { mode: 'non-main' }, runtime: { type: 'embedded' }, skills: ['$WORKSPACE_BASE/tuner/skills/*'] },
  orchestrator: { name: 'Conductor', tools: { profile: 'minimal', alsoAllow: ['sessions_send','sessions_spawn','web_search'] }, sandbox: { mode: 'non-main' }, runtime: { type: 'embedded' }, skills: ['$WORKSPACE_BASE/orchestrator/skills/*'] },
};

for (const agent of (config.agents?.list || [])) {
  if (overrides[agent.id]) {
    Object.assign(agent, overrides[agent.id]);
  }
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('  Patched agent configs: ' + Object.keys(overrides).join(', '));
"

ok "Agent configuration applied."

# --- Step 5: Configure gateway for Sentura Dashboard ---

log "Step 5: Configuring gateway for Sentura Dashboard (controlUi.allowInsecureAuth)..."

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

# --- Step 6: Install Sentura bootstrap hook ---

log "Step 6: Installing sentura-bootstrap hook..."

HOOKS_DIR="$OPENCLAW_STATE/hooks"
HOOK_SOURCE="$PROJECT_ROOT/sentura/hooks/sentura-bootstrap"
HOOK_TARGET="$HOOKS_DIR/sentura-bootstrap"

if [[ -d "$HOOK_SOURCE" ]]; then
  mkdir -p "$HOOKS_DIR"
  rm -rf "$HOOK_TARGET"
  cp -r "$HOOK_SOURCE" "$HOOK_TARGET"
  ok "  → Hook installed at $HOOK_TARGET"

  # Enable the hook in config
  node -e "
const fs = require('fs');
const configPath = '$OPENCLAW_CONFIG';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

if (!config.hooks) config.hooks = {};
if (!config.hooks.internal) config.hooks.internal = {};
config.hooks.internal.enabled = true;
if (!config.hooks.internal.entries) config.hooks.internal.entries = {};
config.hooks.internal.entries['sentura-bootstrap'] = { enabled: true };

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('  Hook enabled in config');
"

  ok "sentura-bootstrap hook enabled."
else
  warn "Hook source not found at $HOOK_SOURCE — skipping hook installation"
fi

# --- Step 7: Summary ---

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
if [[ -d "$HOOK_TARGET" ]]; then
  ok "Hook: sentura-bootstrap → RULES.md + CONTEXT.md injected into system prompt"
fi
echo ""
log "Next steps:"
log "  1. Start the gateway:  cd openclaw && pnpm gateway:watch"
log "  2. Open the UI:        http://localhost:18789"
log "  3. Chat with Forge:    Send a message to create your first AI employee"
echo ""
