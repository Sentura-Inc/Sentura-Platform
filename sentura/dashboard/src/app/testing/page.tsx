"use client";

import { FlaskConical } from "lucide-react";
import { SkeletonShell } from "@/components/skeleton-shell";

export default function TestingPage() {
  return (
    <SkeletonShell
      title="Test Results"
      description="Pre-deployment test scorecard per AI employee — 6 dimensions (correctness / safety / cost / latency / tool-use / regression) with auto-tune iteration history."
      icon={FlaskConical}
      blockingOwner="Person B"
      blockingDeliverable="test runner output schema (capability #15)"
      targetWeek="Week 4"
      willInclude={[
        "Per-employee scorecard — current scores across all 6 dimensions",
        "Auto-tune history — iteration N, what changed, score delta per dimension",
        "Pass/fail gate visualization — which thresholds blocked deployment",
        "Failure diagnostics — links to the failing test cases + Creator Agent's learning notes",
      ]}
    />
  );
}
