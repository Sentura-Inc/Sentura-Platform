# Sentura Platform Setup for Windows (PowerShell)
# Run AFTER `pnpm openclaw onboard` to register Sentura meta-agents.
# Idempotent — safe to re-run.
#
# Usage:
#   .\scripts\sentura-setup.ps1
#   # Or from project root:
#   powershell -ExecutionPolicy Bypass -File scripts\sentura-setup.ps1

param(
    [string]$OpenClawHome = $null
)

$ErrorActionPreference = "Stop"

# --- Path resolution ---

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$OpenClawDir = Join-Path $ProjectRoot "openclaw"

if ($OpenClawHome) {
    $OpenClawState = $OpenClawHome
} elseif ($env:OPENCLAW_HOME) {
    $OpenClawState = $env:OPENCLAW_HOME
} else {
    $OpenClawState = Join-Path $env:USERPROFILE ".openclaw"
}

$OpenClawConfig = Join-Path $OpenClawState "openclaw.json"
$WorkspaceBase = Join-Path $OpenClawState "workspace"

# --- Logging helpers ---

function Log { param([string]$Message) Write-Host "[sentura] $Message" -ForegroundColor Cyan }
function Ok { param([string]$Message) Write-Host "[sentura] $Message" -ForegroundColor Green }
function Warn { param([string]$Message) Write-Host "[sentura] $Message" -ForegroundColor Yellow }
function Err { param([string]$Message) Write-Host "[sentura] $Message" -ForegroundColor Red }

# --- Helper: run OpenClaw CLI from within the openclaw directory ---

function Invoke-OpenClawCli {
    param([string[]]$Arguments)
    $runNode = Join-Path $OpenClawDir "scripts" "run-node.mjs"
    Push-Location $OpenClawDir
    try {
        & node $runNode @Arguments
    } finally {
        Pop-Location
    }
}

# --- Pre-flight checks ---

if (-not (Test-Path $OpenClawConfig)) {
    Err "OpenClaw config not found at $OpenClawConfig"
    Err "Run 'cd openclaw; pnpm openclaw onboard' first."
    exit 1
}

if (-not (Test-Path (Join-Path $OpenClawDir "src"))) {
    Err "OpenClaw source not found at $OpenClawDir\src"
    Err "Ensure the openclaw\ directory is present (git submodule or local clone)."
    exit 1
}

Log "OpenClaw config found at $OpenClawConfig"
Log "Workspace base: $WorkspaceBase"

# --- Helper: copy workspace files ---

function Copy-Workspace {
    param(
        [string]$AgentId,
        [string]$SourceDir
    )

    if (-not (Test-Path $SourceDir)) {
        Warn "Source directory not found: $SourceDir (skipping workspace copy for $AgentId)"
        return $false
    }

    $TargetDir = Join-Path $WorkspaceBase $AgentId
    Log "Copying workspace: $AgentId"

    if (-not (Test-Path $TargetDir)) {
        New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    }

    Get-ChildItem -Path $SourceDir | ForEach-Object {
        if ($_.PSIsContainer) {
            Copy-Item -Path $_.FullName -Destination $TargetDir -Recurse -Force
        } else {
            Copy-Item -Path $_.FullName -Destination $TargetDir -Force
        }
    }

    Ok "  -> $TargetDir"
    return $true
}

# --- Helper: register agent via CLI ---

function Register-Agent {
    param(
        [string]$AgentId,
        [string]$Model = "openai/gpt-4o"
    )

    $WorkspaceDir = Join-Path $WorkspaceBase $AgentId
    Log "Registering agent: $AgentId"

    try {
        $agentList = Invoke-OpenClawCli -Arguments @("agents", "list", "--json") 2>$null
        if ($agentList -match "`"id`":`"$AgentId`"") {
            Warn "  Agent '$AgentId' already registered (skipping)"
            return
        }
    } catch {
        # If agents list fails, try registering anyway
    }

    try {
        Invoke-OpenClawCli -Arguments @(
            "agents", "add", $AgentId,
            "--workspace", $WorkspaceDir,
            "--model", $Model,
            "--non-interactive"
        )
        Ok "  -> Agent '$AgentId' registered"
    } catch {
        Warn "  Failed to register agent '$AgentId': $_"
    }
}

# --- Step 1: Ensure workspace base directory exists ---

Log "Step 1: Ensuring workspace base directory..."
if (-not (Test-Path $WorkspaceBase)) {
    New-Item -ItemType Directory -Path $WorkspaceBase -Force | Out-Null
}

# --- Step 2: Copy meta-agent workspaces ---

Log "Step 2: Copying meta-agent workspace files..."

$MetaAgents = @("creator", "tuner", "orchestrator")
$SenturaAgentsDir = Join-Path $ProjectRoot "sentura" "agents"

foreach ($agent in $MetaAgents) {
    $agentSource = Join-Path $SenturaAgentsDir $agent
    if (Test-Path $agentSource) {
        Copy-Workspace -AgentId $agent -SourceDir $agentSource | Out-Null
    } else {
        Warn "Meta-agent source not found: $agentSource"
    }
}

# --- Step 3: Register meta-agents ---

Log "Step 3: Registering meta-agents with OpenClaw..."

foreach ($agent in $MetaAgents) {
    $agentWorkspace = Join-Path $WorkspaceBase $agent
    if (Test-Path $agentWorkspace) {
        Register-Agent -AgentId $agent
    } else {
        Warn "Workspace not found for $agent - skipping registration"
    }
}

# --- Step 4: Apply advanced config (tools, bindings) via direct JSON patch ---

Log "Step 4: Applying Sentura agent configuration..."

try {
    Invoke-OpenClawCli -Arguments @("config", "set", "agents.defaults.workspace", "--value", "~/.openclaw/workspace")
} catch {
    Warn "  Could not set agents.defaults.workspace: $_"
}

$WorkspaceBaseEscaped = $WorkspaceBase -replace '\\', '/'

$patchScript = @"
const fs = require('fs');
const configPath = '$($OpenClawConfig -replace '\\', '\\\\')';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const wsBase = '$WorkspaceBaseEscaped';
const overrides = {
  creator:      { name: 'Forge',     tools: { profile: 'coding',  alsoAllow: ['gateway','sessions_send','sessions_spawn','web_search','web_fetch','browser','pdf','canvas'] }, sandbox: { mode: 'non-main' }, runtime: { type: 'embedded' }, skills: [wsBase + '/creator/skills/*'] },
  tuner:        { name: 'Refine',    tools: { profile: 'coding',  alsoAllow: ['gateway','sessions_send','web_search','web_fetch'] }, sandbox: { mode: 'non-main' }, runtime: { type: 'embedded' }, skills: [wsBase + '/tuner/skills/*'] },
  orchestrator: { name: 'Conductor', tools: { profile: 'minimal', alsoAllow: ['sessions_send','sessions_spawn','web_search'] }, sandbox: { mode: 'non-main' }, runtime: { type: 'embedded' }, skills: [wsBase + '/orchestrator/skills/*'] },
};

for (const agent of (config.agents?.list || [])) {
  if (overrides[agent.id]) {
    Object.assign(agent, overrides[agent.id]);
  }
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('  Patched agent configs: ' + Object.keys(overrides).join(', '));
"@

node -e $patchScript

Ok "Agent configuration applied."

# --- Step 5: Configure gateway for Sentura Dashboard ---

Log "Step 5: Configuring gateway for Sentura Dashboard..."

$dashboardScript = @"
const fs = require('fs');
const configPath = '$($OpenClawConfig -replace '\\', '\\\\')';
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
"@

node -e $dashboardScript

Ok "Gateway configured for local dashboard access."

# --- Step 6: Install Sentura bootstrap hook ---

Log "Step 6: Installing sentura-bootstrap hook..."

$HooksDir = Join-Path $OpenClawState "hooks"
$HookSource = Join-Path $ProjectRoot "sentura" "hooks" "sentura-bootstrap"
$HookTarget = Join-Path $HooksDir "sentura-bootstrap"

if (Test-Path $HookSource) {
    if (-not (Test-Path $HooksDir)) {
        New-Item -ItemType Directory -Path $HooksDir -Force | Out-Null
    }
    if (Test-Path $HookTarget) {
        Remove-Item -Path $HookTarget -Recurse -Force
    }
    Copy-Item -Path $HookSource -Destination $HookTarget -Recurse -Force
    Ok "  -> Hook installed at $HookTarget"

    $hookScript = @"
const fs = require('fs');
const configPath = '$($OpenClawConfig -replace '\\', '\\\\')';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

if (!config.hooks) config.hooks = {};
if (!config.hooks.internal) config.hooks.internal = {};
config.hooks.internal.enabled = true;
if (!config.hooks.internal.entries) config.hooks.internal.entries = {};
config.hooks.internal.entries['sentura-bootstrap'] = { enabled: true };

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('  Hook enabled in config');
"@

    node -e $hookScript
    Ok "sentura-bootstrap hook enabled."
} else {
    Warn "Hook source not found at $HookSource - skipping hook installation"
}

# --- Step 7: Summary ---

Write-Host ""
Log ("=" * 50)
Ok "Sentura setup complete!"
Log ("=" * 50)
Write-Host ""
Log "Meta-agents registered:"
foreach ($agent in $MetaAgents) {
    $agentWorkspace = Join-Path $WorkspaceBase $agent
    if (Test-Path $agentWorkspace) {
        Ok "  [ok] $agent -> $agentWorkspace"
    } else {
        Warn "  [--] $agent (no workspace)"
    }
}
Write-Host ""
if (Test-Path $HookTarget) {
    Ok "Hook: sentura-bootstrap -> RULES.md + CONTEXT.md injected into system prompt"
}
Write-Host ""
Log "Next steps:"
Log "  1. Start the gateway:  cd openclaw; pnpm gateway:watch"
Log "  2. Open the UI:        http://localhost:18789"
Log "  3. Chat with Forge:    Send a message to create your first AI employee"
Write-Host ""
