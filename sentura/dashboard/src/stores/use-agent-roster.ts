"use client";

import { create } from "zustand";
import type { AgentConfig } from "@/lib/gateway";

/**
 * Canonical client-side cache of the agent roster.
 *
 * **Why a store on top of `useAgents()`?** Multiple surfaces need the roster
 * (employees list, /chat conversation picker, future orchestrator UI) without
 * each re-fetching `agents.list`. The /employees page acts as the canonical
 * hydrator: it calls `useAgents()` then mirrors the result into this store.
 * Other surfaces subscribe via selectors (`useAgentRosterStore(s => s.agents)`)
 * and get reactive updates without an extra RPC.
 *
 * **What this is NOT:** a server-state cache with invalidation. There's no
 * automatic refetch — the hydrator (today /employees) controls when fresh
 * data lands. If invalidation pain shows up in Phase 3, wrap in TanStack
 * Query later (D1 deferral).
 */
interface AgentRosterState {
  agents: AgentConfig[];
  /** Epoch ms of last hydration; null until first set. */
  hydratedAt: number | null;
  setAgents: (agents: AgentConfig[]) => void;
  reset: () => void;
}

export const useAgentRosterStore = create<AgentRosterState>((set) => ({
  agents: [],
  hydratedAt: null,
  setAgents: (agents) => set({ agents, hydratedAt: Date.now() }),
  reset: () => set({ agents: [], hydratedAt: null }),
}));
