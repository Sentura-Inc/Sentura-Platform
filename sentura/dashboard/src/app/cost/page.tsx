"use client";

import { DollarSign } from "lucide-react";
import { SkeletonShell } from "@/components/skeleton-shell";

export default function CostPage() {
  return (
    <SkeletonShell
      title="Cost Center"
      description="LLM spend tracking — per employee, per department, per time range. Token counts, per-model rates, cost attribution back to the originating user / tenant."
      icon={DollarSign}
      blockingOwner="Person A"
      blockingDeliverable="cost tracking backend (LLM call interceptor + per-agent attribution + aggregate API)"
      targetWeek="Week 4"
      willInclude={[
        "Per-employee spend table with sortable columns (input / output / total tokens, USD)",
        "Time-range selector (today / this week / this month / custom range)",
        "Per-department aggregation when multi-tenancy lands (Week 5)",
        "Anomaly highlighter — sessions costing > N× the agent's median",
      ]}
    />
  );
}
