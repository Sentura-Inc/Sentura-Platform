"use client";

import { BookOpen } from "lucide-react";
import { SkeletonShell } from "@/components/skeleton-shell";

export default function KnowledgePage() {
  return (
    <SkeletonShell
      title="Knowledge Manager"
      description="Upload documents to Data Scavenger, browse the Enterprise Knowledge Graph (4 pillars: org / rules / assets / workflows), inspect agent skill distribution."
      icon={BookOpen}
      blockingOwner="Person B"
      blockingDeliverable="Data Scavenger output schema (capability #11 + #12)"
      targetWeek="Week 4"
      willInclude={[
        "Document upload zone — feeds Data Scavenger, returns generated EKG entries",
        "EKG browser — 4 pillars (org / rules / assets / workflows) per agent with provenance",
        "Skill distribution view — which generated SKILL.md files are wired into which agent",
        "Q&A Completion tracker — empty fields cron has flagged for human review",
      ]}
    />
  );
}
