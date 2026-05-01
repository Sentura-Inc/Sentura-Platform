/**
 * Sentura Experience Extraction — capability #13 Tier 3.
 *
 * Listens on `after_tool_call` + `agent_end` hooks to track tool sequences
 * per session. When a session ends, the tool sequence becomes a "candidate"
 * pattern under `~/.openclaw/sentura-experience-extraction/{agentId}/candidates.json`.
 * When a candidate's `occurrences` reaches `minOccurrences` AND its
 * `confidence` reaches `confidenceThreshold`, the pattern is promoted to an
 * experience-link entry under the target agent's
 * `ekg/workflows/experience-links/{linkId}.json5`.
 *
 * Pure helpers + types live in `./src/scoring.ts` so they are importable from
 * test scripts without pulling in the `openclaw/plugin-sdk/plugin-entry`
 * runtime alias.
 *
 * Defaults (overridable via plugin config):
 *   minOccurrences: 3
 *   confidenceThreshold: 0.75
 */

import path from "node:path";
import { definePluginEntry, resolveOpenClawDir, type OpenClawPluginApi } from "./api.js";
import {
  computeSignature,
  isMetaAgent,
  loadCandidateFile,
  saveCandidateFile,
  shouldPromote,
  updateCandidate,
  writeExperienceLink,
  MAX_TOOL_SEQUENCE,
  type CandidateEntry,
  type CandidateFile,
} from "./src/scoring.js";

// Re-export pure helpers + types so plugin consumers (and test scripts that
// somehow find their way through the SDK alias) keep working.
export {
  computeSignature,
  computeConfidence,
  shouldPromote,
  updateCandidate,
  loadCandidateFile,
  saveCandidateFile,
  writeExperienceLink,
  isMetaAgent,
  type CandidateEntry,
  type CandidateFile,
} from "./src/scoring.js";

// ---------------------------------------------------------------------------
// Plugin runtime
// ---------------------------------------------------------------------------

interface ResolvedConfig {
  candidatesDir: string;
  workspaceRoot: string;
  minOccurrences: number;
  confidenceThreshold: number;
}

interface SessionState {
  agentId: string;
  toolSequence: string[];
  startedAt: string;
}

function resolveConfig(raw: Record<string, unknown> | undefined): ResolvedConfig {
  const r = raw ?? {};
  return {
    candidatesDir:
      typeof r.candidatesDir === "string" && (r.candidatesDir as string).trim().length
        ? path.resolve(r.candidatesDir as string)
        : path.join(resolveOpenClawDir(), "sentura-experience-extraction"),
    workspaceRoot:
      typeof r.workspaceRoot === "string" && (r.workspaceRoot as string).trim().length
        ? path.resolve(r.workspaceRoot as string)
        : path.join(resolveOpenClawDir(), "workspace"),
    minOccurrences:
      typeof r.minOccurrences === "number" && (r.minOccurrences as number) >= 2
        ? (r.minOccurrences as number)
        : 3,
    confidenceThreshold:
      typeof r.confidenceThreshold === "number"
        && (r.confidenceThreshold as number) >= 0
        && (r.confidenceThreshold as number) <= 1
        ? (r.confidenceThreshold as number)
        : 0.75,
  };
}

// OpenClaw hook handlers are invoked as `handler(event, ctx)` — see
// openclaw/src/plugins/hooks.ts and openclaw/src/plugins/hook-types.ts.
// `agentId` / `sessionKey` always live on `ctx`. `toolName` lives on both
// the after_tool_call event AND the tool ctx. We read defensively so the
// hook works whether the dispatcher passes them merged or separate.

interface AgentLikeCtx {
  agentId?: string;
  sessionKey?: string;
}

interface ToolEvent {
  toolName?: string;
}

export default definePluginEntry({
  id: "sentura-experience-extraction",
  name: "Sentura Experience Extraction",
  description:
    "Capability #13 Tier 3 — detects recurring task patterns and promotes high-confidence patterns into target agent's ekg/workflows/experience-links/.",
  register(api: OpenClawPluginApi): void {
    const config = resolveConfig(api.pluginConfig ?? {});
    const sessions = new Map<string, SessionState>();

    api.logger.info(
      "[sentura-experience-extraction] Extension registered.",
      "candidatesDir:", config.candidatesDir,
      "minOccurrences:", config.minOccurrences,
      "confidenceThreshold:", config.confidenceThreshold,
    );

    api.on("after_tool_call", async (event: unknown, ctx: unknown) => {
      const e = (event ?? {}) as ToolEvent;
      const c = (ctx ?? {}) as AgentLikeCtx & ToolEvent;
      const agentId = c.agentId;
      const sessionKey = c.sessionKey;
      const toolName = e.toolName ?? c.toolName;
      if (!agentId || !sessionKey || !toolName) return;
      if (isMetaAgent(agentId)) return;
      let state = sessions.get(sessionKey);
      if (!state) {
        state = { agentId, toolSequence: [], startedAt: new Date().toISOString() };
        sessions.set(sessionKey, state);
      }
      if (state.toolSequence.length < MAX_TOOL_SEQUENCE) {
        state.toolSequence.push(toolName);
      }
    });

    api.on("agent_end", async (_event: unknown, ctx: unknown) => {
      const c = (ctx ?? {}) as AgentLikeCtx;
      const agentId = c.agentId;
      const sessionKey = c.sessionKey;
      if (!agentId || !sessionKey) return;
      if (isMetaAgent(agentId)) return;
      const state = sessions.get(sessionKey);
      sessions.delete(sessionKey);
      if (!state || state.toolSequence.length < 2) return;

      const signature = computeSignature(state.toolSequence);
      const now = new Date().toISOString();

      try {
        const file: CandidateFile = loadCandidateFile(config.candidatesDir, agentId);
        const idx = file.candidates.findIndex((c) => c.signature === signature);
        const previous: CandidateEntry | undefined = idx >= 0 ? file.candidates[idx] : undefined;
        const updated = updateCandidate(previous, signature, sessionKey, now);
        if (idx >= 0) file.candidates[idx] = updated;
        else file.candidates.push(updated);
        file.updatedAt = now;

        if (shouldPromote(updated, config)) {
          const linkId = writeExperienceLink(
            config.workspaceRoot,
            agentId,
            updated,
            `Pattern observed across ${updated.occurrences} sessions`,
          );
          updated.promotedAs = linkId;
          if (idx >= 0) file.candidates[idx] = updated;
          api.logger.info?.(
            `[sentura-experience-extraction] Promoted pattern for ${agentId}: ${linkId} (occurrences=${updated.occurrences}, confidence=${updated.confidence.toFixed(2)})`,
          );
        }
        saveCandidateFile(config.candidatesDir, file);
      } catch (err) {
        api.logger.warn?.(`[sentura-experience-extraction] Failed to record pattern for ${agentId}: ${(err as Error).message}`);
      }
    });
  },
});
