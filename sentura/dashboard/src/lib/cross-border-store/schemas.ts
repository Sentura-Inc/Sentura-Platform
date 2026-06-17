import { z } from "zod";

export const CBE_TENANT_ID = "cross-border-ecommerce";
export const CBE_DEFAULT_OPERATOR_USER_ID = "cbe-user-operator-001";

export const CBE_STORE_REQUIRED_ENV = "CBE_DATABASE_URL";
export const CBE_PRODUCT_ROLES = ["admin", "operator"] as const;
export const CBE_OPERATOR_SURFACES = ["personal", "customers", "memory"] as const;
export const CBE_ADMIN_MONITORING_MODULES = [
  "overview",
  "live-tasks",
  "customers",
  "operators",
  "agent-usage",
] as const;

export const CbeRoleSchema = z.enum(CBE_PRODUCT_ROLES);
export const CbeVisibilityScopeSchema = z.enum(["private", "team", "tenant_shared"]);
export const CbeAgentRunStatusSchema = z.enum([
  "queued",
  "running",
  "polling",
  "completed",
  "failed",
  "cancelled",
]);
export const CbeTaskKindSchema = z.enum(["lead", "screening", "accio_memory", "handoff"]);
export const CbeAgentIdSchema = z.enum([
  "cbe-lead-discovery",
  "cbe-buyer-screening",
  "cbe-accio-memory",
]);
export const CbeDataScopeSchema = z.enum(["tenant_monitor", "team_monitor", "own_work"]);
export const CbeDataTierSchema = z.enum(["T0", "T1", "T2", "T3", "T4"]);

export type CbeProductRole = z.infer<typeof CbeRoleSchema>;
export type CbeOperatorSurface = (typeof CBE_OPERATOR_SURFACES)[number];
export type CbeAdminMonitoringModule = (typeof CBE_ADMIN_MONITORING_MODULES)[number];
export type CbeVisibilityScope = z.infer<typeof CbeVisibilityScopeSchema>;
export type CbeAgentRunStatus = z.infer<typeof CbeAgentRunStatusSchema>;
export type CbeTaskKind = z.infer<typeof CbeTaskKindSchema>;
export type CbeAgentId = z.infer<typeof CbeAgentIdSchema>;
export type CbeDataScope = z.infer<typeof CbeDataScopeSchema>;
export type CbeDataTier = z.infer<typeof CbeDataTierSchema>;

export const TenantContextSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  cbeRole: CbeRoleSchema,
  displayName: z.string().min(1),
  teamName: z.string().min(1).optional(),
  departmentId: z.string().min(1).optional(),
  dataScope: CbeDataScopeSchema,
});
export type TenantContext = z.infer<typeof TenantContextSchema>;

export const SourceTypeSchema = z.enum([
  "official_api",
  "official_registry_page",
  "public_web",
  "public_dns",
  "paid_trade_data",
  "demo_fixture",
  "self_reported",
  "unverified",
]);
export const RiskTierSchema = z.enum([
  "trusted_candidate",
  "cautious",
  "insufficient_evidence",
  "high_risk",
]);
export const EvidenceStatusSchema = z.enum([
  "scored",
  "not_applicable",
  "unavailable_api",
  "disabled_by_budget",
  "pending_human_input",
]);
export const ScoreBlockIdSchema = z.enum([
  "legal_identity",
  "domain_email",
  "public_footprint",
  "business_fit",
  "trade_financial",
  "conversation_behavior",
]);

const IsoTimestampSchema = z.string().datetime({ offset: true });
const CountryCodeSchema = z.string().regex(/^[A-Z]{2}$/);
const ConfidenceSchema = z.number().min(0).max(1);

const JsonRecordSchema = z.record(z.string(), z.unknown());

export const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.string().min(1).optional(),
  team_name: z.string().min(1).optional(),
});
export type ListQuery = z.infer<typeof ListQuerySchema>;

export const CreateAgentRunInputSchema = z.object({
  agent_id: CbeAgentIdSchema,
  task_kind: CbeTaskKindSchema,
  status: CbeAgentRunStatusSchema.default("queued"),
  session_key: z.string().min(1).optional(),
  target_record_type: z.string().min(1).optional(),
  target_record_id: z.string().min(1).optional(),
  target_summary: z.string().min(1).optional(),
  current_stage: z.string().min(1).optional(),
  visibility_scope: CbeVisibilityScopeSchema.default("private"),
  metadata_json: JsonRecordSchema.default({}),
});
export type CreateAgentRunInput = z.infer<typeof CreateAgentRunInputSchema>;

export const CreateLeadRunRequestSchema = z.object({
  query_config: JsonRecordSchema,
  target_count: z.number().int().positive().max(500),
  visibility_scope: CbeVisibilityScopeSchema.default("private"),
  session_key: z.string().min(1).optional(),
  target_summary: z.string().min(1).optional(),
});
export type CreateLeadRunRequest = z.infer<typeof CreateLeadRunRequestSchema>;

export const LeadDiscoveryEvidenceSchema = z.object({
  signal: z.string().min(1).optional(),
  source_url: z.string().url(),
  excerpt: z.string().min(1).optional(),
  finding: z.string().min(1).optional(),
  confidence: ConfidenceSchema.optional(),
  query: z.string().min(1).optional(),
  fetched_at: IsoTimestampSchema,
  source_type: SourceTypeSchema.default("public_web"),
}).superRefine((item, ctx) => {
  if (!item.signal && !item.excerpt && !item.finding) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Lead evidence requires signal, excerpt, or finding.",
      path: ["finding"],
    });
  }
});
export type LeadDiscoveryEvidence = z.infer<typeof LeadDiscoveryEvidenceSchema>;

export const LeadCandidateMarkerSchema = z.object({
  lead_id: z.string().min(1).optional(),
  source_run_id: z.string().min(1).optional(),
  company_name: z.string().min(1),
  website: z.string().url().optional(),
  domain: z.string().min(1).optional(),
  country: CountryCodeSchema,
  city: z.string().min(1).optional(),
  buyer_type: z.string().min(1),
  matched_products: z.array(z.string().min(1)).min(1),
  source_urls: z.array(z.string().url()).min(1),
  discovery_evidence: z.array(LeadDiscoveryEvidenceSchema).min(1),
  dedupe_key: z.string().min(1).optional(),
  duplicate_status: z.enum(["new", "possible_duplicate", "duplicate"]).default("new"),
  confidence: ConfidenceSchema.optional(),
  created_at: IsoTimestampSchema.optional(),
});
export type LeadCandidateMarker = z.infer<typeof LeadCandidateMarkerSchema>;

export const LeadMarkerPayloadSchema = z.object({
  run_id: z.string().min(1).optional(),
  leads: z.array(LeadCandidateMarkerSchema).min(1),
  shortage_reason: z.string().min(1).optional(),
});
export type LeadMarkerPayload = z.infer<typeof LeadMarkerPayloadSchema>;

export const CompleteLeadRunRequestSchema = z.object({
  agent_run_id: z.string().min(1),
  session_key: z.string().min(1),
  payload: LeadMarkerPayloadSchema,
});
export type CompleteLeadRunRequest = z.infer<typeof CompleteLeadRunRequestSchema>;

export const CreateScreeningRunRequestSchema = z.object({
  target_summary: z.string().min(1),
  target_record_type: z.string().min(1).optional(),
  target_record_id: z.string().min(1).optional(),
  visibility_scope: CbeVisibilityScopeSchema.default("private"),
  session_key: z.string().min(1).optional(),
  metadata_json: JsonRecordSchema.default({}),
});
export type CreateScreeningRunRequest = z.infer<typeof CreateScreeningRunRequestSchema>;

export const ScreeningTargetMarkerSchema = z.object({
  target_id: z.string().min(1).optional(),
  source: z.enum(["marketing_lead", "marketing_lead_batch", "manual_input", "accio_memory"]).default("manual_input"),
  lead_id: z.string().min(1).nullable().optional(),
  company_name: z.string().min(1).optional(),
  country: CountryCodeSchema.optional(),
  website: z.string().url().optional(),
  domain: z.string().min(1).optional(),
  email: z.string().email().optional(),
  contact_person: z.string().min(1).optional(),
  product_interest: z.array(z.string().min(1)).default([]),
  supplied_fields: z.array(z.string().min(1)).default([]),
  missing_fields: z.array(z.string().min(1)).default([]),
});
export type ScreeningTargetMarker = z.infer<typeof ScreeningTargetMarkerSchema>;

export const ScreeningEvidenceMarkerSchema = z.object({
  layer: z.string().min(1).default("public_footprint"),
  source_type: SourceTypeSchema,
  source: z.string().min(1).optional(),
  source_url: z.string().url().optional(),
  url: z.string().url().optional(),
  finding: z.string().min(1),
  confidence: ConfidenceSchema.optional(),
  fetched_at: IsoTimestampSchema,
  cost_usd: z.number().min(0).optional(),
  score_block: ScoreBlockIdSchema.optional(),
  score_impact: z.enum(["positive", "negative", "neutral", "coverage_only"]).default("neutral"),
}).superRefine((item, ctx) => {
  if (!item.source_url && !item.url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Screening evidence requires source_url or url.",
      path: ["source_url"],
    });
  }
});
export type ScreeningEvidenceMarker = z.infer<typeof ScreeningEvidenceMarkerSchema>;

export const ScreeningScoreBlockMarkerSchema = z.object({
  block: ScoreBlockIdSchema,
  status: EvidenceStatusSchema,
  max_points: z.number().positive().optional(),
  earned_points: z.number().min(0).nullable().optional(),
  source_count: z.number().int().min(0).optional(),
  summary: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
});
export type ScreeningScoreBlockMarker = z.infer<typeof ScreeningScoreBlockMarkerSchema>;

export const ScreeningReportMarkerSchema = z.object({
  report_id: z.string().min(1).optional(),
  lead_id: z.string().min(1).nullable().optional(),
  target_source: z.enum(["marketing_lead", "marketing_lead_batch", "manual_input", "accio_memory"]).optional(),
  company_name: z.string().min(1),
  target: ScreeningTargetMarkerSchema.optional(),
  risk_tier: RiskTierSchema,
  normalized_score: z.number().min(0).max(100).nullable(),
  evidence_coverage: z.number().min(0).max(1),
  recommended_action: z.string().min(1),
  score_blocks: z.array(ScreeningScoreBlockMarkerSchema).min(1),
  evidence: z.array(ScreeningEvidenceMarkerSchema).min(1),
  coverage_gaps: z.array(JsonRecordSchema).default([]),
  open_questions: z.array(z.string().min(1)).default([]),
  created_at: IsoTimestampSchema.optional(),
});
export type ScreeningReportMarker = z.infer<typeof ScreeningReportMarkerSchema>;

export const ScreeningMarkerPayloadSchema = z.object({
  reports: z.array(ScreeningReportMarkerSchema).min(1),
});
export type ScreeningMarkerPayload = z.infer<typeof ScreeningMarkerPayloadSchema>;

export const CompleteScreeningRunRequestSchema = z.object({
  agent_run_id: z.string().min(1),
  session_key: z.string().min(1),
  payload: ScreeningMarkerPayloadSchema,
});
export type CompleteScreeningRunRequest = z.infer<typeof CompleteScreeningRunRequestSchema>;

export const RedactedAccioMessageSchema = z.object({
  message_ts: IsoTimestampSchema.optional(),
  sender_role: z.string().min(1).optional(),
  text_hash: z.string().min(12),
  text_redacted: z.string().min(1).optional(),
  attachment_json: z.array(JsonRecordSchema).default([]),
});
export type RedactedAccioMessage = z.infer<typeof RedactedAccioMessageSchema>;

export const AccioConversationImportSchema = z.object({
  external_conversation_id: z.string().min(1).optional(),
  company_name: z.string().min(1).optional(),
  country: CountryCodeSchema.optional(),
  contact_person: z.string().min(1).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  messages: z.array(RedactedAccioMessageSchema).default([]),
});
export type AccioConversationImport = z.infer<typeof AccioConversationImportSchema>;

export const CreateAccioImportRequestSchema = z.object({
  source_file_name: z.string().min(1).optional(),
  file_hash: z.string().min(16),
  storage_key: z.string().min(1).optional(),
  classification: CbeDataTierSchema.default("T2"),
  visibility_scope: CbeVisibilityScopeSchema.default("private"),
  session_key: z.string().min(1).optional(),
  conversations: z.array(AccioConversationImportSchema).default([]),
});
export type CreateAccioImportRequest = z.infer<typeof CreateAccioImportRequestSchema>;

export const AccioSummaryMarkerSchema = z.object({
  conversation_id: z.string().min(1),
  customer_profile: JsonRecordSchema.and(z.object({
    company_name: z.string().min(1),
    country: CountryCodeSchema.optional(),
    contact_person: z.string().min(1).optional(),
    email: z.string().email().optional(),
    website: z.string().url().optional(),
  })),
  purchase_intent: z.array(JsonRecordSchema).default([]),
  negotiated_prices: z.array(JsonRecordSchema).default([]),
  negotiation_summary: z.string().min(1),
  next_actions: z.array(z.string().min(1)).min(1),
  behavior_signals: JsonRecordSchema.default({}),
  screening_handoff_target: JsonRecordSchema.optional(),
  memory_preview: JsonRecordSchema.default({ status: "preview_only" }),
  source_references: z.array(z.object({
    source_type: SourceTypeSchema.default("self_reported"),
    source_file: z.string().min(1),
    conversation_id: z.string().min(1),
  })).min(1),
});
export type AccioSummaryMarker = z.infer<typeof AccioSummaryMarkerSchema>;

export const AccioSummaryMarkerPayloadSchema = z.object({
  summaries: z.array(AccioSummaryMarkerSchema).min(1),
});
export type AccioSummaryMarkerPayload = z.infer<typeof AccioSummaryMarkerPayloadSchema>;

export const CompleteAccioImportRequestSchema = z.object({
  agent_run_id: z.string().min(1),
  session_key: z.string().min(1),
  payload: AccioSummaryMarkerPayloadSchema,
});
export type CompleteAccioImportRequest = z.infer<typeof CompleteAccioImportRequestSchema>;

export const CreateHandoffRequestSchema = z.object({
  from_agent_id: CbeAgentIdSchema,
  to_agent_id: CbeAgentIdSchema,
  assigned_to_user_id: z.string().min(1).optional(),
  source_record_type: z.string().min(1),
  source_record_id: z.string().min(1),
  payload_json: JsonRecordSchema,
  status: z.enum(["pending", "accepted", "completed", "cancelled"]).default("pending"),
  visibility_scope: CbeVisibilityScopeSchema.default("private"),
});
export type CreateHandoffRequest = z.infer<typeof CreateHandoffRequestSchema>;

export const NotificationReadRequestSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});
export type NotificationReadRequest = z.infer<typeof NotificationReadRequestSchema>;

export const FailEmployeeTaskRequestSchema = z.object({
  session_key: z.string().min(1).optional(),
  error_code: z.enum([
    "gateway",
    "backend_error",
    "marker_missing",
    "parse_error",
    "timeout",
    "marker_parse_failed",
    "unknown",
  ]),
  error_message: z.string().min(1),
  details: JsonRecordSchema.optional(),
});
export type FailEmployeeTaskRequest = z.infer<typeof FailEmployeeTaskRequestSchema>;
