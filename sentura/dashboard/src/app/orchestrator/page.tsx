"use client";

import { GitBranch } from "lucide-react";
import { SkeletonShell } from "@/components/skeleton-shell";

export default function OrchestratorPage() {
  return (
    <SkeletonShell
      title="Orchestrator"
      description="Mode B operations — task decomposition, multi-agent assignment, progress tracking, Manager EKG (capabilities, conflicts, global SOPs)."
      icon={GitBranch}
      blockingOwner="Person B"
      blockingDeliverable="Orchestrator agent (Conductor) + Manager EKG schema"
      targetWeek="Week 4"
      willInclude={[
        "Task decomposition view — top-level goal → subtasks → assigned employees",
        "Per-subtask progress + dependencies + status (pending / running / blocked / done)",
        "Manager EKG panel — capabilities (M1), conflicts (M2), global SOPs (M3)",
        "Cross-task event timeline with drill-down to individual sessions",
      ]}
    />
  );
}
