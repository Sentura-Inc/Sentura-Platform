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

# Prefer a meta-agent model that the local auth store can actually run.
function Resolve-PreferredMetaAgentModel {
    if ($env:SENTURA_META_AGENT_MODEL -is [string] -and $env:SENTURA_META_AGENT_MODEL.Contains('/')) {
        return $env:SENTURA_META_AGENT_MODEL
    }

    if ($env:OPENAI_API_KEY -is [string] -and $env:OPENAI_API_KEY.Trim().Length -gt 0) {
        return "openai/gpt-5.5"
    }

    $AuthProfilesPath = Join-Path $OpenClawState "agents" "main" "agent" "auth-profiles.json"

    if (Test-Path $AuthProfilesPath) {
        try {
            $auth = Get-Content $AuthProfilesPath -Raw | ConvertFrom-Json -Depth 20
            $profileIds = @($auth.profiles.PSObject.Properties.Name)
            if ($profileIds | Where-Object { $_ -like 'openai:*' }) {
                return "openai/gpt-5.5"
            }
            if ($profileIds | Where-Object { $_ -like 'deepseek:*' }) {
                return "deepseek/deepseek-reasoner"
            }
        } catch {
            Warn "Could not parse auth profiles at $AuthProfilesPath - falling back to config/default model."
        }
    }

    try {
        $config = Get-Content $OpenClawConfig -Raw | ConvertFrom-Json -Depth 20
        $primary = $config.agents.defaults.model.primary
        if ($primary -is [string] -and $primary.Contains('/')) {
            return $primary
        }
    } catch {
        Warn "Could not parse $OpenClawConfig while resolving preferred meta-agent model."
    }

    return "openai/gpt-5.5"
}

$MetaAgentModel = Resolve-PreferredMetaAgentModel
Log "Preferred meta-agent model: $MetaAgentModel"

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
        [string]$Model = $null
    )

    if (-not $Model) {
        $Model = $script:MetaAgentModel
    }

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

# --- Step 2: Copy source-agent workspaces ---

Log "Step 2: Copying source-agent workspace files..."

$MetaAgents = @("creator", "tuner", "orchestrator", "mcp-builder", "data-scavenger")
$ClientDemoAgents = @("zuolian-travel-concierge", "cbe-lead-discovery", "cbe-buyer-screening", "cbe-accio-memory")
$SourceAgents = @($MetaAgents + $ClientDemoAgents)
$SenturaAgentsDir = Join-Path $ProjectRoot "sentura" "agents"

foreach ($agent in $MetaAgents) {
    $agentSource = Join-Path $SenturaAgentsDir $agent
    if (Test-Path $agentSource) {
        Copy-Workspace -AgentId $agent -SourceDir $agentSource | Out-Null
    } else {
        Warn "Meta-agent source not found: $agentSource"
    }
}

foreach ($agent in $ClientDemoAgents) {
    $agentSource = Join-Path $SenturaAgentsDir $agent
    if (Test-Path $agentSource) {
        Copy-Workspace -AgentId $agent -SourceDir $agentSource | Out-Null
    } else {
        Warn "Client-demo agent source not found: $agentSource"
    }
}

Log "Ensuring Sentura workspace directories (ekg/, memory/users/)..."
foreach ($agent in $SourceAgents) {
    $target = Join-Path $WorkspaceBase $agent
    if (Test-Path $target) {
        New-Item -ItemType Directory -Path (Join-Path $target "ekg/org") -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $target "ekg/rules") -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $target "ekg/assets") -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $target "ekg/workflows/experience-links") -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $target "memory/users") -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $target "skills") -Force | Out-Null
    }
}
Ok "Sentura workspace directories ensured."

# Mark each source-agent workspace as "bootstrap complete" for OpenClaw.
#
# WHY: OpenClaw (openclaw/src/agents/workspace.ts -> resolveWorkspaceBootstrapStatus)
# treats a workspace as "bootstrap pending" while BOOTSTRAP.md exists on disk AND
# .openclaw/workspace-state.json does not have setupCompletedAt set. When pending,
# the runtime injects a "[Bootstrap pending]" prefix into every turn's user
# prompt and, for non-primary runs (e.g. dashboard-spawned sessions), forces the
# agent into "limited" mode, which blocks Forge from deploying new employees
# from the dashboard. Sentura keeps BOOTSTRAP.md permanently because it hosts
# the `## Enterprise Context` section, so we stamp setupCompletedAt instead of
# deleting the file. See scripts/sentura-setup.sh for the matching bash logic.
Log "Stamping setupCompletedAt into source-agent workspace state..."
$StateNow = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
foreach ($agent in $SourceAgents) {
    $agentWorkspace = Join-Path $WorkspaceBase $agent
    if (-not (Test-Path $agentWorkspace)) {
        continue
    }
    $stateDir = Join-Path $agentWorkspace ".openclaw"
    $stateFile = Join-Path $stateDir "workspace-state.json"
    if (-not (Test-Path $stateDir)) {
        New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
    }
    $env:AGENT_ID = $agent
    $env:STATE_FILE = $stateFile
    $env:STATE_NOW = $StateNow
    $stampScript = @'
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
'@
    & node -e $stampScript
    Remove-Item Env:AGENT_ID -ErrorAction SilentlyContinue
    Remove-Item Env:STATE_FILE -ErrorAction SilentlyContinue
    Remove-Item Env:STATE_NOW -ErrorAction SilentlyContinue
}
Ok "Source-agent workspaces marked as bootstrap-complete."

# --- Step 3: Register source agents ---

Log "Step 3: Registering source agents with OpenClaw..."

foreach ($agent in $SourceAgents) {
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
const path = require('path');
const configPath = '$($OpenClawConfig -replace '\\', '\\\\')';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const preferredModel = process.env.SENTURA_META_AGENT_MODEL || 'openai/gpt-5.5';
// Cross-border employees keep mainland-deployable domestic models selectable.
// SENTURA_CBE_AGENT_MODEL flips their primary (e.g. 'deepseek/deepseek-chat')
// at install time without editing source configs.
const cbePreferredModel = process.env.SENTURA_CBE_AGENT_MODEL || preferredModel;
const cbeDomesticModelRefs = ['deepseek/deepseek-chat', 'qwen/qwen3.5-plus', 'moonshot/kimi-k2.6'];
const cbeDomesticModelOptions = Object.fromEntries(
  cbeDomesticModelRefs.map((modelRef) => [modelRef, { agentRuntime: { id: 'openclaw' } }]),
);
// 429/quota resilience: a 429 on the primary otherwise suspends the shared
// Main lane (all agents) for 30 min. Configure a real fallback chain so the
// runtime switches provider instead of self-suspending under load.
const cbeFallbackModels = cbeDomesticModelRefs.filter((m) => m !== cbePreferredModel);
const cbeAgentModel = { primary: cbePreferredModel, fallbacks: cbeFallbackModels };
// Bounded Docker sandbox resources (scope=agent => one container per cbe agent).
const cbeSandboxDocker = { memory: '2g', memorySwap: '2g', cpus: 1, pidsLimit: 256, ulimits: { nofile: '4096:8192' } };
const openClawState = process.env.OPENCLAW_STATE || '';
config.agents = config.agents || {};
config.agents.defaults = config.agents.defaults || {};
config.agents.defaults.models = config.agents.defaults.models || {};
// Concurrency: set the shared Main lane cap explicitly (OpenClaw default 4).
config.agents.defaults.maxConcurrent = Number(process.env.SENTURA_MAX_CONCURRENT) || 8;

function readDotEnvFile(filePath) {
  const entries = {};
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
      if (!match) continue;
      let value = match[2] || '';
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
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
    if (providerId === 'qwen') entry.alias = 'Qwen';
    if (providerId === 'moonshot') entry.alias = 'Kimi';
  }
  config.agents.defaults.models[modelRef] = entry;
  if (!existing) {
    console.log('  Allowlisted preferred model: ' + modelRef);
  }
}

ensurePreferredModelAllowlistEntry(preferredModel);
ensurePreferredModelAllowlistEntry(cbePreferredModel);
for (const modelRef of cbeDomesticModelRefs) {
  ensurePreferredModelAllowlistEntry(modelRef);
}

// NOTE: we deliberately do NOT set agent.skills here. In OpenClaw,
// agents.list[].skills is a NAME filter (array of skill names), not a
// path glob. Writing a path like '{workspace}/skills/*' matched zero
// skill names and silenced every SKILL.md in the sandbox. Omitting the
// field falls back to the default discovery path (workspace/skills/*/
// SKILL.md), which is what we want.
//
// SANDBOX TOOL-POLICY FIX (Round 20, 2026-04-19) -- mirror of
// scripts/sentura-setup.sh. OpenClaw's non-main sandbox applies a
// SECOND tool filter after the agent-level alsoAllow step. Any plugin
// tool (sentura_agents_manage, gateway, browser, pdf, canvas, cron,
// memory_*, update_plan, image_generate, video_generate, web_fetch,
// web_search, sentura_rbac_manage, sentura_audit_query) is stripped at
// the sandbox stage unless it also appears in
// tools.sandbox.tools.alsoAllow. Without this block, the dashboard
// chat.send path hands Forge a 7-tool toolset and the model refuses
// to deploy. The CLI 'openclaw agent' path is NOT affected -- this is
// the CLI-vs-dashboard divergence documented in docs/SETUP.md.
const creatorSandboxAlsoAllow = [
  'gateway','sessions_send','web_search','web_fetch','browser','pdf','canvas',
  'sentura_agents_manage','sentura_rbac_manage','sentura_audit_query',
  'memory_search','memory_get','cron','update_plan','image_generate','video_generate'
];
const tunerSandboxAlsoAllow = [
  'gateway','sessions_send','web_search','web_fetch',
  'sentura_agents_manage','sentura_rbac_manage','sentura_audit_query',
  'memory_search','memory_get','update_plan','pdf','canvas','cron'
];
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
  [cbePreferredModel]: { agentRuntime: { id: 'openclaw' } },
  ...cbeDomesticModelOptions
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
  [cbePreferredModel]: { agentRuntime: { id: 'openclaw' } },
  ...cbeDomesticModelOptions
};
const cbeScreeningToolsDeny = [
  'agents_list','browser','canvas','create_goal','cron','exec','gateway','get_goal',
  'image','image_generate','message','nodes','pdf','process','read','session_status',
  'sessions_history','sessions_list','sessions_send','sessions_spawn','sessions_yield',
  'skill_workshop','subagents','tts','update_goal','update_plan','video_generate',
  'edit','apply_patch','write'
];
const cbeAccioToolAllow = ['memory_search','memory_get','group:plugins'];
const cbeAccioSandboxAllow = ['memory_search','memory_get','cross-border-intel__*'];
const cbeAccioModels = {
  [cbePreferredModel]: { agentRuntime: { id: 'openclaw' } },
  ...cbeDomesticModelOptions
};
const cbeAccioToolsDeny = [
  'agents_list','browser','canvas','create_goal','cron','exec','gateway','get_goal',
  'image','image_generate','message','nodes','pdf','process','read','session_status',
  'sessions_history','sessions_list','sessions_send','sessions_spawn','sessions_yield',
  'skill_workshop','subagents','tts','update_goal','update_plan','video_generate',
  'edit','apply_patch','write'
];

const overrides = {
  creator:         { name: 'Forge',     model: preferredModel, tools: { profile: 'coding',  alsoAllow: ['gateway','sessions_send','sessions_spawn','web_search','web_fetch','browser','pdf','canvas','sentura_agents_manage','sentura_rbac_manage','sentura_audit_query'], deny: ['write','edit','apply_patch','exec'], sandbox: { tools: { alsoAllow: creatorSandboxAlsoAllow } } }, sandbox: { mode: 'non-main' }, runtime: { type: 'embedded' } },
  tuner:           { name: 'Refine',    model: preferredModel, tools: { profile: 'coding',  alsoAllow: ['gateway','sessions_send','web_search','web_fetch'], sandbox: { tools: { alsoAllow: tunerSandboxAlsoAllow } } }, sandbox: { mode: 'non-main' }, runtime: { type: 'embedded' } },
  orchestrator:    { name: 'Conductor', model: preferredModel, tools: { profile: 'minimal', alsoAllow: ['sessions_send','sessions_spawn','web_search'], sandbox: { tools: { alsoAllow: orchestratorSandboxAlsoAllow } } }, sandbox: { mode: 'non-main' }, runtime: { type: 'embedded' } },
  'mcp-builder':   { name: 'Socket',    model: preferredModel, tools: { profile: 'coding',  alsoAllow: ['gateway','sessions_send','web_search','web_fetch','browser','pdf'], deny: ['sessions_spawn','subagents','sessions_yield'], sandbox: { tools: { alsoAllow: mcpBuilderSandboxAlsoAllow } } }, sandbox: { mode: 'non-main' }, runtime: { type: 'embedded' } },
  'data-scavenger':{ name: 'Scout',     model: preferredModel, tools: { profile: 'coding',  alsoAllow: ['pdf','web_fetch','web_search','sentura_agents_manage','memory_search'], deny: ['sessions_spawn','subagents','sessions_yield','browser','exec','write','edit','apply_patch'], sandbox: { tools: { alsoAllow: dataScavengerSandboxAlsoAllow } } }, sandbox: { mode: 'non-main', workspaceAccess: 'rw' }, runtime: { type: 'embedded' } },
  'zuolian-travel-concierge': { name: '座联出行客服', model: preferredModel, models: zuolianModels, tools: { profile: 'coding', allow: zuolianToolAllow, deny: zuolianToolsDeny, sandbox: { tools: { allow: zuolianSandboxAllow } } }, sandbox: { mode: 'non-main' }, runtime: { type: 'embedded' }, params: { role: 'Sitlink AI travel customer-support employee', language: 'zh-CN', demoScope: 'Phase 1 fixture-first web/chat demo with web research supplement' } },
  'cbe-lead-discovery': { name: '跨境营销获客员工', model: cbeAgentModel, models: cbeLeadModels, tools: { profile: 'minimal', alsoAllow: cbeLeadToolAllow, deny: cbeLeadToolsDeny, sandbox: { tools: { alsoAllow: cbeLeadSandboxAllow } } }, sandbox: { mode: 'non-main', docker: cbeSandboxDocker }, runtime: { type: 'embedded' }, params: { role: 'Cross-border mobile-accessory Marketing Acquisition employee', language: 'zh-CN', tenant: 'cross-border-ecommerce', demoScope: 'Phase 1 public-search lead discovery with typed Screening handoff preview' } },
  'cbe-buyer-screening': { name: '跨境筛选背调员工', model: cbeAgentModel, models: cbeScreeningModels, tools: { profile: 'minimal', alsoAllow: cbeScreeningToolAllow, deny: cbeScreeningToolsDeny, sandbox: { tools: { alsoAllow: cbeScreeningSandboxAllow } } }, sandbox: { mode: 'non-main', docker: cbeSandboxDocker }, runtime: { type: 'embedded' }, params: { role: 'Cross-border mobile-accessory Screening and Background Investigation employee', language: 'zh-CN', tenant: 'cross-border-ecommerce', demoScope: 'Phase 1 low-cost live buyer background investigation with contextual scoring' } },
  'cbe-accio-memory': { name: '跨境记忆处理员工', model: cbeAgentModel, models: cbeAccioModels, tools: { profile: 'minimal', alsoAllow: cbeAccioToolAllow, deny: cbeAccioToolsDeny, sandbox: { tools: { alsoAllow: cbeAccioSandboxAllow } } }, sandbox: { mode: 'non-main', docker: cbeSandboxDocker }, runtime: { type: 'embedded' }, params: { role: 'Cross-border mobile-accessory Accio Memory Processing employee', language: 'zh-CN', tenant: 'cross-border-ecommerce', demoScope: 'Phase 1 simulated Accio chat parsing, deal summary, memory preview, and Screening handoff' } },
};

for (const agent of (config.agents?.list || [])) {
  if (overrides[agent.id]) {
    Object.assign(agent, overrides[agent.id]);
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
if (!config.bindings.some((b) => b && b.agentId === 'cbe-accio-memory' && b.match?.channel === 'webchat')) {
  config.bindings.push({
    agentId: 'cbe-accio-memory',
    match: { channel: 'webchat', peer: { kind: 'dm', id: '*' } },
  });
  console.log('  Added webchat binding for cbe-accio-memory');
}

config.mcp = config.mcp || {};
config.mcp.servers = config.mcp.servers || {};
config.mcp.servers['dida-travel-demo'] = {
  command: 'node',
  args: ['$($ProjectRoot -replace '\\', '/')/sentura/mcp-servers/dida-travel-demo/dist/index.js'],
  cwd: '$($ProjectRoot -replace '\\', '/')',
  env: { DIDA_DEMO_MODE: 'fixture' },
};
config.mcp.servers['cross-border-intel'] = {
  command: 'node',
  args: ['$($ProjectRoot -replace '\\', '/')/sentura/mcp-servers/cross-border-intel/dist/index.js'],
  cwd: '$($ProjectRoot -replace '\\', '/')',
  env: buildCrossBorderIntelEnv(),
  requestTimeoutMs: setupEnvNumber('CBE_INTEL_REQUEST_TIMEOUT_MS', 30000),
};
console.log('  Added/updated MCP server: cross-border-intel');
if (hasSetupEnv('TAVILY_API_KEY')) {
  console.log('  Detected TAVILY_API_KEY for OpenClaw web_search and CBE Dashboard live search');
}

config.agents.defaults.sandbox = config.agents.defaults.sandbox || {};
config.agents.defaults.sandbox.browser = config.agents.defaults.sandbox.browser || {};
if (config.agents.defaults.sandbox.browser.enabled !== true) {
  config.agents.defaults.sandbox.browser.enabled = true;
  console.log('  Enabled agents.defaults.sandbox.browser.enabled = true');
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('  Patched agent configs: ' + Object.keys(overrides).join(', '));
"@

$env:SENTURA_META_AGENT_MODEL = $MetaAgentModel
$env:OPENCLAW_STATE = $OpenClawState
node -e $patchScript
Remove-Item Env:SENTURA_META_AGENT_MODEL -ErrorAction SilentlyContinue
Remove-Item Env:OPENCLAW_STATE -ErrorAction SilentlyContinue

Ok "Agent configuration applied."

# --- Step 4b: Apply default tenancy to every registered agent ---
#
# Mirrors `scripts/sentura-setup.sh` Step 4b. Sentura's multi-tenancy
# model lives in `agent-tenancy.json` (Sentura-side) — never inside
# `agents.list[]` — so `sentura-cost`/`sentura-monitoring` can attribute
# events without falling back to "unknown tenant". Idempotent.

Log "Step 4b: Applying default tenancy to registered agents..."

$RbacDataDirForTenancy = Join-Path $OpenClawState "sentura-rbac"
if (-not (Test-Path $RbacDataDirForTenancy)) {
    New-Item -ItemType Directory -Path $RbacDataDirForTenancy -Force | Out-Null
}

$tenancyScript = @"
const fs = require('fs');
const path = require('path');
const configPath = '$($OpenClawConfig -replace '\\', '\\\\')';
const tenancyPath = path.join('$($RbacDataDirForTenancy -replace '\\', '\\\\')', 'agent-tenancy.json');

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const agents = (config.agents && config.agents.list) || [];
if (agents.length === 0) {
  console.log('  No registered agents - skipping tenancy seed.');
  process.exit(0);
}

let records = [];
try { records = JSON.parse(fs.readFileSync(tenancyPath, 'utf8')); } catch (_) {}

const seen = new Set(records.map((r) => r.agentId));
const now = new Date().toISOString();
let added = 0;
for (const agent of agents) {
  if (!seen.has(agent.id)) {
    records.push({ agentId: agent.id, tenantId: 'default', departmentId: null, updatedAt: now });
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
"@

node -e $tenancyScript

Ok "Agent tenancy applied."

# --- Step 4c: Configure per-agent LanceDB memory isolation ---
#
# Mirrors `scripts/sentura-setup.sh` Step 5. Stamps
# `agents.list[].params.memoryDbPath` for every agent missing one so the
# Sentura memory layer (`sentura-memory-lancedb`) lands in a per-agent
# directory under `~/.openclaw/memory/<agentId>/lancedb`.

Log "Step 4c: Configuring per-agent LanceDB memory isolation..."

$memoryIsolationScript = @"
const fs = require('fs');
const configPath = '$($OpenClawConfig -replace '\\', '\\\\')';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

let updated = 0;
for (const agent of (config.agents && config.agents.list) || []) {
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
"@

node -e $memoryIsolationScript

Ok "Per-agent LanceDB isolation configured."

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

# --- Step 6a: Wire Sentura extensions into OpenClaw ---
#
# Mirrors `scripts/sentura-setup.sh` Step 7a. Adds each extension's
# directory to `plugins.load.paths` and enables it in `plugins.entries`.
# When `sentura-memory-lancedb` is enabled in this run, also disables
# the upstream `memory-lancedb` plugin so the two `kind: "memory"`
# entries don't collide.

Log "Step 6a: Wiring Sentura extensions (plugins.load.paths + plugins.entries)..."

$SenturaExtensionsDir = Join-Path $ProjectRoot "sentura" "extensions"
$SenturaExtIds = @(
    "sentura-agents",
    "sentura-rbac",
    "sentura-audit",
    "sentura-approval",
    "sentura-provisioner",
    "sentura-memory-lancedb",
    "sentura-cost",
    "sentura-monitoring"
)

$extTuples = @()
foreach ($extId in $SenturaExtIds) {
    $extDir = Join-Path $SenturaExtensionsDir $extId
    $manifest = Join-Path $extDir "openclaw.plugin.json"
    $entry = Join-Path $extDir "index.ts"
    if ((Test-Path $manifest) -and (Test-Path $entry)) {
        $extTuples += "$extId|$extDir"
        Ok "  -> $extId present at $extDir"
    } else {
        Warn "  X $extId missing (expected $manifest + index.ts) - skipping"
    }
}

if ($extTuples.Count -gt 0) {
    $env:SENTURA_EXT_TUPLES = ($extTuples -join "`n")
    $extWiringScript = @"
const fs = require('fs');
const configPath = '$($OpenClawConfig -replace '\\', '\\\\')';
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
  const current = config.plugins.entries[id] || {};
  if (current.enabled !== true) {
    config.plugins.entries[id] = { ...current, enabled: true };
    entriesChanged++;
  }
}

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
  // the plugin never boots. Seed a default embedding block on first install
  // using the documented `${OPENAI_API_KEY}` env-interpolation token (per
  // the plugin's own uiHints.embedding.apiKey.help). The inner config
  // nests under entry.config — that is the path OpenClaw's plugin loader
  // feeds into the plugin's configSchema. Idempotent: only seeds when
  // config.embedding is missing — operators can hand-edit either field
  // afterward and re-runs of setup will leave their values alone.
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
          apiKey: '`${OPENAI_API_KEY}`',
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
  console.log('  seeded sentura-memory-lancedb.embedding (`${OPENAI_API_KEY}` + text-embedding-3-small)');
}
"@
    node -e $extWiringScript
    Remove-Item Env:SENTURA_EXT_TUPLES -ErrorAction SilentlyContinue
    Ok "Sentura extensions wired."
} else {
    Warn "  No Sentura extensions found on disk - plugins.load.paths left unchanged."
}

# --- Step 6b: Clear stale meta-agent sandboxes ---
#
# Mirrors `scripts/sentura-setup.sh` Step 7b. Forces the
# sentura-sandbox-seed hook to re-mirror skills/, ekg/, and a customized
# BOOTSTRAP.md on next agent boot.

Log "Step 6b: Clearing stale meta-agent sandboxes (forces clean re-seed)..."

$SandboxRoot = Join-Path $OpenClawState "sandboxes"
if (Test-Path $SandboxRoot) {
    foreach ($agent in $MetaAgents) {
        $agentSandboxes = Get-ChildItem -Path $SandboxRoot -Filter "agent-$agent-*" -Directory -ErrorAction SilentlyContinue
        foreach ($dir in $agentSandboxes) {
            Remove-Item -Path $dir.FullName -Recurse -Force -ErrorAction SilentlyContinue
            Ok "  -> cleared stale sandbox $($dir.FullName)"
        }
    }
} else {
    Log "  No sandbox root at $SandboxRoot yet - nothing to clear."
}

# --- Step 6b2: Ensure the diagnostic-event bus is on ---
#
# Mirrors `scripts/sentura-setup.sh` Step 7b2. OpenClaw gates `model.usage`
# (and every other diagnostic event) behind `config.diagnostics.enabled === true`.
# If unset, NO events fire and Sentura's `sentura-cost` + `sentura-monitoring`
# extensions stay silent - the dashboard's `/cost` page reads as "zero
# activity" even when users are chatting. Step 6c (OTel) used to be the
# only place that flipped this, but it only ran when
# OTEL_EXPORTER_OTLP_ENDPOINT was set, so operators without OTel silently
# lost cost tracking. This step decouples the bus from the OTel sink:
# diagnostics are now ALWAYS on after setup. Idempotent.

Log "Step 6b2: Ensuring diagnostic-event bus is enabled..."

$diagBusScript = @"
const fs = require('fs');
const configPath = '$($OpenClawConfig -replace '\\', '\\\\')';
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
"@
node -e $diagBusScript
Ok "Diagnostic-event bus enabled."

# --- Step 6c: Wire OpenTelemetry via diagnostics-otel ---
#
# Mirrors `scripts/sentura-setup.sh` Step 7c. Reads
# OTEL_EXPORTER_OTLP_ENDPOINT and stamps the matching `diagnostics.otel`
# block + enables the `diagnostics-otel` plugin entry. Skips silently if
# the env var is unset.

Log "Step 6c: Wiring OpenTelemetry (diagnostics-otel)..."

if ($env:OTEL_EXPORTER_OTLP_ENDPOINT) {
    $otelScript = @"
const fs = require('fs');
const configPath = '$($OpenClawConfig -replace '\\', '\\\\')';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const serviceName = process.env.OTEL_SERVICE_NAME || 'openclaw-sentura';

if (!config.plugins) config.plugins = {};
if (!config.plugins.entries || typeof config.plugins.entries !== 'object') {
  config.plugins.entries = {};
}
const current = config.plugins.entries['diagnostics-otel'] || {};
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
const otelBlock = config.diagnostics.otel || {};
const desiredOtel = {
  ...otelBlock,
  enabled: true,
  endpoint,
  serviceName: otelBlock.serviceName || serviceName,
};
let otelFlipped = false;
if (
  otelBlock.enabled !== true ||
  otelBlock.endpoint !== endpoint ||
  (otelBlock.serviceName || '') !== desiredOtel.serviceName
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
"@
    node -e $otelScript
    Ok "OpenTelemetry wired."
} else {
    Log "  OTel disabled - set OTEL_EXPORTER_OTLP_ENDPOINT to enable trace/metric export."
}

# --- Step 7: Seed the first platform admin (customer-facing: no curl required) ---
#
# See the long comment in scripts/sentura-setup.sh Step 8 for the full
# rationale. Short version: without a real platform_admin in the RBAC
# store every guarded RPC runs in bootstrap mode with a synthetic
# `__bootstrap__` actor, which is only meant to exist for the very first
# upsert. We close that gap by seeding the admin directly into the
# store's JSON file. The gateway does NOT need to be running.
#
# Inputs (priority order):
#   1. Env vars: $env:SENTURA_ADMIN_NAME, $env:SENTURA_ADMIN_EMAIL
#   2. Interactive prompts if the host is interactive
#   3. Defaults: "Platform Admin" / "admin@sentura.local"
#
# Idempotent: if any platform_admin already exists, reuse their token.

Log "Step 7: Seeding first platform admin (so no curl required)..."

$RbacDataDir = Join-Path $OpenClawState "sentura-rbac"
$RbacUsersFile = Join-Path $RbacDataDir "users.json"
$DashboardEnvFile = Join-Path $ProjectRoot "sentura" "dashboard" ".env.local"

if (-not (Test-Path $RbacDataDir)) {
    New-Item -ItemType Directory -Path $RbacDataDir -Force | Out-Null
}

$adminStatusScript = @"
const fs = require('fs');
const p = '$($RbacUsersFile -replace '\\', '\\\\')';
let users = [];
try { users = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) {}
const admin = users.find((u) => u && u.role === 'platform_admin');
if (admin) {
  process.stdout.write('EXISTS\t' + admin.id + '\t' + admin.email + '\t' + admin.userToken);
} else {
  process.stdout.write('MISSING');
}
"@
$AdminStatus = & node -e $adminStatusScript

if ($AdminStatus -like "EXISTS*") {
    $parts = $AdminStatus -split "`t"
    $AdminId = $parts[1]
    $AdminEmail = $parts[2]
    $AdminToken = $parts[3]
    Ok "  Platform admin already seeded: $AdminEmail (id=$AdminId)"
    Log "  Skipping seed step (re-runs are safe). Re-using existing credentials for the dashboard wiring below."
}
else {
    $AdminName = $env:SENTURA_ADMIN_NAME
    $AdminEmail = $env:SENTURA_ADMIN_EMAIL

    $canPrompt = [Environment]::UserInteractive -and ($Host.Name -ne 'Default Host') -and -not $env:SENTURA_ADMIN_NONINTERACTIVE

    if (-not $AdminName -or -not $AdminEmail) {
        if ($canPrompt) {
            Log "  No SENTURA_ADMIN_* env vars set - prompting for the first admin's identity."
            Log "  (Set `$env:SENTURA_ADMIN_NAME / `$env:SENTURA_ADMIN_EMAIL / `$env:SENTURA_ADMIN_NONINTERACTIVE=1 to skip prompts next time.)"
            if (-not $AdminName) {
                $defaultName = if ($env:USERNAME) { $env:USERNAME } else { "Platform Admin" }
                $reply = Read-Host "  Admin full name [$defaultName]"
                if ([string]::IsNullOrWhiteSpace($reply)) { $AdminName = $defaultName } else { $AdminName = $reply }
            }
            if (-not $AdminEmail) {
                $defaultEmail = "admin@sentura.local"
                $reply = Read-Host "  Admin email [$defaultEmail]"
                if ([string]::IsNullOrWhiteSpace($reply)) { $AdminEmail = $defaultEmail } else { $AdminEmail = $reply }
            }
        }
        else {
            if (-not $AdminName) { $AdminName = "Platform Admin" }
            if (-not $AdminEmail) { $AdminEmail = "admin@sentura.local" }
            Log "  Non-interactive - using name=`"$AdminName`", email=`"$AdminEmail`"."
        }
    }

    if ($AdminEmail -notmatch '@') {
        Err "  Admin email must contain '@' - got: $AdminEmail"
        exit 1
    }

    $env:SENTURA_ADMIN_NAME = $AdminName
    $env:SENTURA_ADMIN_EMAIL = $AdminEmail

    $seedScript = @"
const fs = require('fs');
const crypto = require('crypto');
const p = '$($RbacUsersFile -replace '\\', '\\\\')';
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
users = users.filter((u) => u && u.email !== email);
users.push(user);
const tmp = p + '.tmp';
fs.writeFileSync(tmp, JSON.stringify(users, null, 2), 'utf8');
fs.renameSync(tmp, p);
process.stdout.write(user.id + '\t' + user.email + '\t' + user.userToken);
"@
    $SeedResult = & node -e $seedScript
    $parts = $SeedResult -split "`t"
    $AdminId = $parts[0]
    $AdminEmail = $parts[1]
    $AdminToken = $parts[2]
    Ok "  Seeded platform admin: $AdminEmail"
    Ok "  -> id:    $AdminId"
    Ok "  -> token: $AdminToken"
}

Log "  Wiring dashboard .env.local with admin credentials..."

$env:SENTURA_ADMIN_USER_ID = $AdminId
$env:SENTURA_ADMIN_USER_TOKEN = $AdminToken
$env:SENTURA_DASHBOARD_ENV_FILE = $DashboardEnvFile

$envWireScript = @"
const fs = require('fs');
const path = require('path');
const p = process.env.SENTURA_DASHBOARD_ENV_FILE;
const adminId = process.env.SENTURA_ADMIN_USER_ID;
const adminToken = process.env.SENTURA_ADMIN_USER_TOKEN;

let body = '';
try { body = fs.readFileSync(p, 'utf8'); } catch (_) { body = ''; }

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
  'Sentura platform admin user id (seeded by scripts/sentura-setup.ps1, Step 7)');
next = upsertLine(next, 'NEXT_PUBLIC_SENTURA_ADMIN_TOKEN', adminToken,
  'Sentura platform admin userToken (sent as actorId on RBAC-guarded RPCs)');
next = upsertLine(next, 'NEXT_PUBLIC_SENTURA_CREATOR_HANDSHAKE_ENABLED', 'true',
  'When true, dashboard auto-creates a welcome session for newly-deployed employees on /create. Set to false to disable.');

if (next !== body) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, next, 'utf8');
  console.log('  -> updated ' + p);
} else {
  console.log('  -> ' + p + ' already has admin keys');
}
"@
node -e $envWireScript

Ok "Dashboard admin credentials wired."
Log "  The dashboard will pick these up on next ``pnpm dev`` (or restart). No curl step required."

# --- Step 8: Summary ---

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
    Ok "Hook: sentura-bootstrap -> per-user memory (memory/users/MEMORY_USER_{token}.md) injected into system prompt"
}
Write-Host ""
if ($AdminEmail -and $AdminToken) {
    Log "Platform admin:"
    Ok  "  email:     $AdminEmail"
    Ok  "  id:        $AdminId"
    Ok  "  userToken: $AdminToken"
    Log "  (token also written to sentura/dashboard/.env.local as NEXT_PUBLIC_SENTURA_ADMIN_TOKEN)"
    Write-Host ""
}
Log "Next steps:"
Log "  1. Start the gateway:  cd openclaw; pnpm gateway:watch"
Log "  2. Start the dashboard: cd sentura/dashboard; pnpm dev"
Log "  3. Open:               http://localhost:18789 (OpenClaw Control UI)"
Log "                         http://localhost:3000  (Sentura dashboard)"
Log "  4. Chat with Forge:    Send a message to create your first AI employee"
Log "                         (runs as the seeded platform admin - not bootstrap mode)"
Write-Host ""
