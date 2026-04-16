#!/usr/bin/env bash
set -euo pipefail

# Configure the MCP loopback server in OpenClaw config.
# The loopback server allows agents to communicate with the OpenClaw gateway
# itself as an MCP server — useful for testing and internal tool access.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OPENCLAW_DIR="$PROJECT_ROOT/openclaw"
OPENCLAW_STATE="${OPENCLAW_HOME:-$HOME/.openclaw}"
OPENCLAW_CONFIG="$OPENCLAW_STATE/openclaw.json"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
NC='\033[0m'

log()   { echo -e "${BLUE}[mcp-loopback]${NC} $*"; }
ok()    { echo -e "${GREEN}[mcp-loopback]${NC} $*"; }

if [[ ! -f "$OPENCLAW_CONFIG" ]]; then
  echo "OpenClaw config not found at $OPENCLAW_CONFIG" >&2
  echo "Run 'cd openclaw && pnpm openclaw onboard' first." >&2
  exit 1
fi

log "Configuring MCP loopback server..."

node -e "
const fs = require('fs');
const path = require('path');
const configPath = '$OPENCLAW_CONFIG';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

if (!config.mcp) config.mcp = {};
if (!config.mcp.servers) config.mcp.servers = {};

if (config.mcp.servers['openclaw-loopback']) {
  console.log('  MCP loopback server already configured');
  process.exit(0);
}

// The loopback server uses OpenClaw's built-in MCP channel server.
// It provides conversation management tools via the MCP protocol.
config.mcp.servers['openclaw-loopback'] = {
  command: 'node',
  args: [path.resolve('$OPENCLAW_DIR', 'dist', 'mcp', 'channel-server.js')],
  env: {
    OPENCLAW_HOME: '$OPENCLAW_STATE',
  },
};

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('  MCP loopback server added to config');
"

ok "MCP loopback server configured."
log "Agents can now use 'openclaw-loopback' MCP tools for conversation management."
