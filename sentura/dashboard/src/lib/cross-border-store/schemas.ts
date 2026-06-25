import { z } from "zod";

export const CBE_TENANT_ID = "cross-border-ecommerce";
export const CBE_DEFAULT_OPERATOR_USER_ID = "cbe-user-operator-001";

export const CBE_STORE_REQUIRED_ENV = "CBE_DATABASE_URL";
export const CBE_PRODUCT_ROLES = ["admin", "operator"] as const;
export const CBE_OPERATOR_SURFACES = ["personal", "customers", "memory"] as const;
export const CBE_ADMIN_MONITORING_MODULES = [
  "employees",
  "high-value-customers",
  "costs",
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
export const CbeCostPeriodSchema = z.enum(["day", "week", "month", "all_time"]);
export const CbeCostApprovalStatusSchema = z.enum(["pending", "approved", "rejected", "cancelled"]);
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
export type CbeCostPeriod = z.infer<typeof CbeCostPeriodSchema>;
export type CbeCostApprovalStatus = z.infer<typeof CbeCostApprovalStatusSchema>;
export type CbeAgentId = z.infer<typeof CbeAgentIdSchema>;
export type CbeDataScope = z.infer<typeof CbeDataScopeSchema>;
export type CbeDataTier = z.infer<typeof CbeDataTierSchema>;

function roundMoneyUsd(value: number) {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export const CbeMoneyUsdSchema = z.number().min(0).transform(roundMoneyUsd);

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
  "google_maps_places",
  "google_maps_geocoding",
  "google_maps_address_validation",
  "paid_email_validation",
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
export const CompanyScaleClassSchema = z.enum([
  "listed_or_public",
  "medium_large_registered",
  "small_local_offline",
  "small_online_only",
  "unknown_scale",
]);
export const CompanyScaleFirstBlockStrategySchema = z.enum([
  "registry_disclosure_primary_maps_support",
  "maps_physical_address_primary",
  "domain_public_source_primary",
  "try_registry_and_maps",
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
  owner_user_id: z.string().min(1).optional(),
  range: z.enum(["today", "week", "month", "all"]).default("month"),
});
export type ListQuery = z.infer<typeof ListQuerySchema>;

export const CreateAgentRunInputSchema = z.object({
  agent_id: CbeAgentIdSchema,
  task_kind: CbeTaskKindSchema,
  status: CbeAgentRunStatusSchema.default("queued"),
  session_key: z.string().min(1).optional(),
  parent_agent_run_id: z.string().min(1).optional(),
  target_record_type: z.string().min(1).optional(),
  target_record_id: z.string().min(1).optional(),
  target_summary: z.string().min(1).optional(),
  current_stage: z.string().min(1).optional(),
  queue_priority: z.number().int().default(0),
  queued_at: z.string().datetime({ offset: true }).optional(),
  lease_owner: z.string().min(1).optional(),
  lease_until: z.string().datetime({ offset: true }).optional(),
  cost_usd_estimate: CbeMoneyUsdSchema.optional(),
  visibility_scope: CbeVisibilityScopeSchema.default("private"),
  metadata_json: JsonRecordSchema.default({}),
});
export type CreateAgentRunInput = z.infer<typeof CreateAgentRunInputSchema>;

export const CreateLeadRunRequestSchema = z.object({
  query_config: JsonRecordSchema,
  target_count: z.number().int().positive().max(20),
  run_mode: z.enum(["new_scope", "top_up_unique_leads"]).default("new_scope"),
  visibility_scope: CbeVisibilityScopeSchema.default("private"),
  session_key: z.string().min(1).optional(),
  target_summary: z.string().min(1).optional(),
  estimated_cost_usd: CbeMoneyUsdSchema.default(0),
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
  google_place_id: z.string().min(1).optional(),
  google_maps_uri: z.string().url().optional(),
  field_mask_profile: z.string().min(1).optional(),
  business_status: z.string().min(1).optional(),
  formatted_address: z.string().min(1).optional(),
  endpoint: z.string().min(1).optional(),
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
  google_place_id: z.string().min(1).optional(),
  google_maps_uri: z.string().url().optional(),
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

export const ScreeningTargetMarkerSchema = z.object({
  target_id: z.string().min(1).optional(),
  source: z.enum(["marketing_lead", "marketing_lead_batch", "manual_input"]).default("manual_input"),
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

export const CreateScreeningRunRequestSchema = z.object({
  target_summary: z.string().min(1),
  target_record_type: z.string().min(1).optional(),
  target_record_id: z.string().min(1).optional(),
  visibility_scope: CbeVisibilityScopeSchema.default("private"),
  session_key: z.string().min(1).optional(),
  child_session_keys: z.array(z.string().min(1)).max(10).optional(),
  targets: z.array(ScreeningTargetMarkerSchema).min(1).max(10).optional(),
  estimated_cost_usd: CbeMoneyUsdSchema.default(0),
  metadata_json: JsonRecordSchema.default({}),
});
export type CreateScreeningRunRequest = z.infer<typeof CreateScreeningRunRequestSchema>;

export const ClaimQueuedScreeningRunsRequestSchema = z.object({
  screening_batch_id: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(10).default(3),
});
export type ClaimQueuedScreeningRunsRequest = z.infer<typeof ClaimQueuedScreeningRunsRequestSchema>;

export const RetryScreeningChildRunRequestSchema = z.object({
  session_key: z.string().min(1).optional(),
  reapprove_paid_email: z.boolean().default(false),
  reapprove_paid_trade: z.boolean().default(false),
  approval_reason: z.string().min(1).max(500).optional(),
});
export type RetryScreeningChildRunRequest = z.infer<typeof RetryScreeningChildRunRequestSchema>;

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

export const AddressFootprintCoverageStatusSchema = z.enum([
  "found",
  "partial",
  "not_found",
  "unavailable_api",
  "not_checked",
]);

export const AddressFootprintAddressTypeSchema = z.enum([
  "headquarters_or_office",
  "storefront",
  "warehouse_or_distribution",
  "service_or_repair_location",
  "unknown_business_location",
]);

export const AddressFootprintRelationshipStatusSchema = z.enum([
  "confirmed_company_location",
  "probable_company_location",
  "possible_related_location",
  "rejected_unrelated_location",
]);

export const ScreeningAddressFootprintSchema = z.object({
  section_title: z.string().min(1).default("Google Maps 地址版图"),
  coverage_status: AddressFootprintCoverageStatusSchema,
  search_scope: z.object({
    queries_run: z.array(z.string().min(1)).default([]),
    countries: z.array(z.string().min(1)).default([]),
    capped: z.boolean().default(false),
    limitations: z.array(z.string().min(1)).default([]),
  }).default({
    queries_run: [],
    countries: [],
    capped: false,
    limitations: [],
  }),
  summary: z.object({
    total_locations: z.number().int().min(0).default(0),
    confirmed_locations: z.number().int().min(0).default(0),
    probable_locations: z.number().int().min(0).default(0),
    possible_related_locations: z.number().int().min(0).default(0),
    operational_locations: z.number().int().min(0).default(0),
    closed_locations: z.number().int().min(0).default(0),
    countries: z.array(z.string().min(1)).default([]),
    cities: z.array(z.string().min(1)).default([]),
  }).default({
    total_locations: 0,
    confirmed_locations: 0,
    probable_locations: 0,
    possible_related_locations: 0,
    operational_locations: 0,
    closed_locations: 0,
    countries: [],
    cities: [],
  }),
  locations: z.array(z.object({
    google_place_id: z.string().min(1).optional(),
    display_name: z.string().min(1),
    address_type: AddressFootprintAddressTypeSchema.default("unknown_business_location"),
    relationship_status: AddressFootprintRelationshipStatusSchema.default("possible_related_location"),
    formatted_address: z.string().min(1),
    city: z.string().min(1).optional(),
    region: z.string().min(1).optional(),
    country: z.string().min(1).optional(),
    business_status: z.string().min(1).optional(),
    types: z.array(z.string().min(1)).default([]),
    website_uri: z.string().url().optional(),
    domain_match: z.union([z.boolean(), z.literal("not_checked")]).optional(),
    phone_match: z.union([z.boolean(), z.literal("not_checked"), z.literal("conflict")]).optional(),
    address_validation: z.object({
      status: z.string().min(1).optional(),
      address_complete: z.boolean().optional(),
      possible_next_action: z.string().min(1).optional(),
    }).optional(),
    google_maps_uri: z.string().url().optional(),
    match_confidence: ConfidenceSchema.optional(),
    match_reasons: z.array(z.string().min(1)).default([]),
    source_type: SourceTypeSchema.default("google_maps_places"),
    fetched_at: IsoTimestampSchema.optional(),
  })).default([]),
  open_questions: z.array(z.string().min(1)).default([]),
});
export type ScreeningAddressFootprint = z.infer<typeof ScreeningAddressFootprintSchema>;

export const ScreeningReportMarkerSchema = z.object({
  report_id: z.string().min(1).optional(),
  lead_id: z.string().min(1).nullable().optional(),
  target_source: z.enum(["marketing_lead", "marketing_lead_batch", "manual_input"]).optional(),
  company_name: z.string().min(1),
  target: ScreeningTargetMarkerSchema.optional(),
  company_scale_assessment: z.object({
    scale_class: CompanyScaleClassSchema,
    confidence: ConfidenceSchema.optional(),
    rationale: z.string().min(1),
    first_block_strategy: CompanyScaleFirstBlockStrategySchema,
  }).optional(),
  risk_tier: RiskTierSchema,
  normalized_score: z.number().min(0).max(100).nullable(),
  evidence_coverage: z.number().min(0).max(1),
  recommended_action: z.string().min(1),
  score_blocks: z.array(ScreeningScoreBlockMarkerSchema).min(1),
  evidence: z.array(ScreeningEvidenceMarkerSchema).min(1),
  address_footprint: ScreeningAddressFootprintSchema.optional(),
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

export const AccioImportSourceKindSchema = z.enum([
  "manual_json",
  "manual_text",
  "manual_image",
  "alibaba_international",
  "demo_data",
  "other",
]);
export type AccioImportSourceKind = z.infer<typeof AccioImportSourceKindSchema>;

export const AccioImportInputFormatSchema = z.enum(["json", "pasted_text", "image"]);
export type AccioImportInputFormat = z.infer<typeof AccioImportInputFormatSchema>;

export const CreateAccioImportRequestSchema = z.object({
  source_file_name: z.string().min(1).optional(),
  source_kind: AccioImportSourceKindSchema.default("manual_json"),
  input_format: AccioImportInputFormatSchema.default("json"),
  attachment_metadata: z.array(JsonRecordSchema).default([]),
  file_hash: z.string().min(16),
  storage_key: z.string().min(1).optional(),
  classification: CbeDataTierSchema.default("T2"),
  visibility_scope: CbeVisibilityScopeSchema.default("private"),
  session_key: z.string().min(1).optional(),
  estimated_cost_usd: CbeMoneyUsdSchema.default(0),
  conversations: z.array(AccioConversationImportSchema).default([]),
});
export type CreateAccioImportRequest = z.infer<typeof CreateAccioImportRequestSchema>;

export const AdminCreateOperatorRequestSchema = z.object({
  display_name: z.string().min(1),
  password: z.string().min(4),
  email: z.string().email().optional(),
  team_name: z.string().min(1).optional(),
  department_id: z.string().min(1).optional(),
  initial_limits: z.array(z.object({
    period: CbeCostPeriodSchema,
    limit_usd: CbeMoneyUsdSchema,
    enabled: z.boolean().default(true),
  })).default([]),
});
export type AdminCreateOperatorRequest = z.infer<typeof AdminCreateOperatorRequestSchema>;

export const AdminUpdateOperatorRequestSchema = z.object({
  status: z.enum(["active", "suspended"]).optional(),
  display_name: z.string().min(1).optional(),
  team_name: z.string().min(1).nullable().optional(),
  password: z.string().min(4).optional(),
});
export type AdminUpdateOperatorRequest = z.infer<typeof AdminUpdateOperatorRequestSchema>;

export const AdminCostLimitPatchRequestSchema = z.object({
  user_id: z.string().min(1),
  period: CbeCostPeriodSchema,
  limit_usd: CbeMoneyUsdSchema,
  enabled: z.boolean().default(true),
});
export type AdminCostLimitPatchRequest = z.infer<typeof AdminCostLimitPatchRequestSchema>;

export const AdminCostAllowancePatchRequestSchema = z.object({
  user_id: z.string().min(1),
  period: CbeCostPeriodSchema.default("month"),
  amount_usd: CbeMoneyUsdSchema,
});
export type AdminCostAllowancePatchRequest = z.infer<typeof AdminCostAllowancePatchRequestSchema>;

export const AdminCostApprovalDecisionRequestSchema = z.object({
  request_id: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  approved_amount_usd: CbeMoneyUsdSchema.optional(),
  expires_at: z.string().datetime({ offset: true }).optional(),
  decision_note: z.string().min(1).optional(),
});
export type AdminCostApprovalDecisionRequest = z.infer<typeof AdminCostApprovalDecisionRequestSchema>;

export const DeleteMemoryRecordsRequestSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});
export type DeleteMemoryRecordsRequest = z.infer<typeof DeleteMemoryRecordsRequestSchema>;

export const DeleteCustomerRecordsRequestSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});
export type DeleteCustomerRecordsRequest = z.infer<typeof DeleteCustomerRecordsRequestSchema>;

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

export const NotificationDeleteRequestSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});
export type NotificationDeleteRequest = z.infer<typeof NotificationDeleteRequestSchema>;

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

export const CancelEmployeeTaskRequestSchema = z.object({
  session_key: z.string().min(1).optional(),
});
export type CancelEmployeeTaskRequest = z.infer<typeof CancelEmployeeTaskRequestSchema>;
