import { z } from "zod";

export const CbeRoleSchema = z.enum(["admin", "operator"]);
export type CbeRole = z.infer<typeof CbeRoleSchema>;

export const CbeVisibilityScopeSchema = z.enum(["private", "team", "tenant_shared"]);
export type CbeVisibilityScope = z.infer<typeof CbeVisibilityScopeSchema>;

export const CbeAgentRunStatusSchema = z.enum([
  "queued",
  "running",
  "polling",
  "completed",
  "failed",
  "cancelled",
]);
export type CbeAgentRunStatus = z.infer<typeof CbeAgentRunStatusSchema>;

export const CbeTaskKindSchema = z.enum(["lead", "screening", "accio_memory", "handoff"]);
export type CbeTaskKind = z.infer<typeof CbeTaskKindSchema>;

export const CbeMigrationFileSchema = z.object({
  id: z.string().regex(/^\d{3}$/),
  name: z.string().min(1),
  fileName: z.string().endsWith(".sql"),
  checksum: z.string().min(32),
});
export type CbeMigrationFile = z.infer<typeof CbeMigrationFileSchema>;

export const CbeSeedSummarySchema = z.object({
  tenantId: z.string(),
  seededUsers: z.number().int().nonnegative(),
  adminProfiles: z.number().int().nonnegative(),
  operatorProfiles: z.number().int().nonnegative(),
});
export type CbeSeedSummary = z.infer<typeof CbeSeedSummarySchema>;
