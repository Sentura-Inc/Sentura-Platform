import { z } from "zod";

export const SourceTypeValues = [
  "official_api",
  "official_registry_page",
  "public_web",
  "public_dns",
  "paid_trade_data",
  "demo_fixture",
  "self_reported",
  "unverified",
] as const;

export const EvidenceStatusValues = [
  "scored",
  "not_applicable",
  "unavailable_api",
  "disabled_by_budget",
  "pending_human_input",
] as const;

export const ScoreBlockIdValues = [
  "legal_identity",
  "domain_email",
  "public_footprint",
  "business_fit",
  "trade_financial",
  "conversation_behavior",
] as const;

export const RiskTierValues = [
  "trusted_candidate",
  "cautious",
  "insufficient_evidence",
  "high_risk",
] as const;

export const SourceTypeSchema = z.enum(SourceTypeValues);
export const EvidenceStatusSchema = z.enum(EvidenceStatusValues);
export const ScoreBlockIdSchema = z.enum(ScoreBlockIdValues);
export const RiskTierSchema = z.enum(RiskTierValues);

const IsoTimestampSchema = z.string().datetime({ offset: true });
const CountryCodeSchema = z.string().regex(/^[A-Z]{2}$/, "Expected ISO 3166-1 alpha-2 country code");
const ConfidenceSchema = z.number().min(0).max(1);

export const ContactCandidateSchema = z.object({
  type: z.enum(["email", "phone", "contact_form", "social_profile", "person"]),
  value: z.string().min(1),
  source_url: z.string().url().optional(),
  confidence: ConfidenceSchema,
});

export const DiscoveryEvidenceSchema = z.object({
  signal: z.string().min(1),
  source_url: z.string().url(),
  excerpt: z.string().min(1),
  confidence: ConfidenceSchema,
  query: z.string().min(1).optional(),
  fetched_at: IsoTimestampSchema.optional(),
  source_type: SourceTypeSchema.default("public_web"),
});

export const LeadCandidateSchema = z.object({
  lead_id: z.string().min(1),
  source_run_id: z.string().min(1),
  company_name: z.string().min(1),
  website: z.string().url().optional(),
  domain: z.string().min(1).optional(),
  country: CountryCodeSchema,
  city: z.string().min(1).optional(),
  buyer_type: z.string().min(1),
  matched_products: z.array(z.string().min(1)).min(1),
  contact_candidates: z.array(ContactCandidateSchema).default([]),
  source_urls: z.array(z.string().url()).min(1),
  discovery_evidence: z.array(DiscoveryEvidenceSchema).min(1),
  dedupe_key: z.string().min(1),
  duplicate_status: z.enum(["new", "possible_duplicate", "duplicate"]).default("new"),
  created_at: IsoTimestampSchema,
});

export const InvestigationTargetSchema = z.object({
  target_id: z.string().min(1),
  source: z.enum(["marketing_lead", "manual_input", "accio_memory"]),
  lead_id: z.string().min(1).nullable().optional(),
  company_name: z.string().min(1).optional(),
  country: CountryCodeSchema.optional(),
  website: z.string().url().optional(),
  domain: z.string().min(1).optional(),
  email: z.string().email().optional(),
  contact_person: z.string().min(1).optional(),
  contact_title: z.string().min(1).optional(),
  social_or_profile_url: z.string().url().optional(),
  product_interest: z.array(z.string().min(1)).default([]),
  operator_notes: z.string().min(1).optional(),
  supplied_fields: z.array(z.string().min(1)).default([]),
  inferred_fields: z.array(z.string().min(1)).default([]),
  missing_fields: z.array(z.string().min(1)).default([]),
}).superRefine((target, ctx) => {
  if (!target.company_name && !target.domain && !target.email && !target.website) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one of company_name, domain, email, or website is required.",
      path: ["company_name"],
    });
  }
});

export const ScoreBlockSchema = z.object({
  block: ScoreBlockIdSchema,
  status: EvidenceStatusSchema,
  max_points: z.number().positive(),
  earned_points: z.number().min(0).nullable().optional(),
  source_count: z.number().int().min(0).optional(),
  summary: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
}).superRefine((block, ctx) => {
  if (block.status === "scored") {
    if (typeof block.earned_points !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scored blocks require numeric earned_points.",
        path: ["earned_points"],
      });
      return;
    }
    if (block.earned_points > block.max_points) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "earned_points cannot exceed max_points.",
        path: ["earned_points"],
      });
    }
  }
});

export const ScreeningEvidenceSchema = z.object({
  layer: z.enum([
    "registry",
    "domain_email",
    "website_social_footprint",
    "trade_customs",
    "financial_public_filing",
    "business_fit",
    "behavior",
  ]),
  source_type: SourceTypeSchema,
  source: z.string().min(1),
  url: z.string().url().optional(),
  finding: z.string().min(1),
  score_block: ScoreBlockIdSchema.optional(),
  score_impact: z.enum(["positive", "negative", "neutral", "coverage_only"]).default("neutral"),
  confidence: ConfidenceSchema.optional(),
  fetched_at: IsoTimestampSchema.optional(),
  cost_usd: z.number().min(0).optional(),
});

export const MissingEvidenceSchema = z.object({
  block: ScoreBlockIdSchema,
  status: EvidenceStatusSchema.exclude(["scored", "not_applicable"]),
  recommended_next_step: z.string().min(1),
  reason: z.string().min(1).optional(),
});

export const ContextualScoreResultSchema = z.object({
  profile: z.string().min(1),
  normalized_score: z.number().min(0).max(100).nullable(),
  evidence_coverage: z.number().min(0).max(1),
  risk_tier: RiskTierSchema,
  raw_score: z.number().min(0),
  score_denominator: z.number().min(0),
  coverage_denominator: z.number().min(0),
  forced_downgrades: z.array(z.string().min(1)).default([]),
  blocks: z.array(ScoreBlockSchema),
});

export const ScreeningReportSchema = z.object({
  report_id: z.string().min(1),
  lead_id: z.string().min(1).nullable().optional(),
  target_source: z.enum(["marketing_lead", "manual_input", "accio_memory"]),
  company_name: z.string().min(1),
  risk_tier: RiskTierSchema,
  normalized_score: z.number().min(0).max(100).nullable(),
  evidence_coverage: z.number().min(0).max(1),
  recommended_action: z.string().min(1),
  score_blocks: z.array(ScoreBlockSchema).min(1),
  evidence: z.array(ScreeningEvidenceSchema).default([]),
  open_questions: z.array(z.string().min(1)).default([]),
  missing_or_unavailable_evidence: z.array(MissingEvidenceSchema).default([]),
  created_at: IsoTimestampSchema,
});

export const AccioChatMessageSchema = z.object({
  timestamp: IsoTimestampSchema,
  sender: z.enum(["buyer", "seller", "system"]),
  text: z.string().min(1),
});

export const AccioAttachmentSchema = z.object({
  file_name: z.string().min(1),
  type: z.string().min(1),
  description: z.string().min(1).optional(),
});

export const AccioBuyerSchema = z.object({
  display_name: z.string().min(1),
  company_name: z.string().min(1),
  country: CountryCodeSchema,
  city: z.string().min(1).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  claimed_role: z.string().min(1).optional(),
});

export const AccioConversationSchema = z.object({
  conversation_id: z.string().min(1),
  buyer: AccioBuyerSchema,
  messages: z.array(AccioChatMessageSchema).min(1),
  attachments: z.array(AccioAttachmentSchema).default([]),
});

export const AccioChatExportSchema = z.object({
  export_metadata: z.object({
    platform: z.string().min(1),
    exported_at: IsoTimestampSchema,
    seller_company: z.string().min(1),
    source_file: z.string().min(1),
    data_classification: z.string().min(1),
  }),
  conversations: z.array(AccioConversationSchema).min(1),
});

export const AccioPurchaseIntentSchema = z.object({
  product: z.string().min(1),
  models: z.array(z.string().min(1)).default([]),
  quantity: z.number().int().positive().optional(),
  monthly_potential_quantity: z.number().int().positive().optional(),
  packaging: z.string().min(1).optional(),
  target_price_usd: z.number().positive().optional(),
  seller_best_price_usd: z.number().positive().optional(),
  packaging_addon_usd: z.number().min(0).optional(),
  incoterm: z.string().min(1).optional(),
  payment_terms: z.string().min(1).optional(),
  logistics_terms: z.string().min(1).optional(),
  certification_terms: z.string().min(1).optional(),
});

export const AccioBehaviorSignalsSchema = z.object({
  inquiry_professionalism_points: z.number().min(0).max(10),
  responsiveness_points: z.number().min(0).max(10),
  notes: z.string().min(1),
});

export const AccioChatSummarySchema = z.object({
  conversation_id: z.string().min(1),
  customer_profile: z.object({
    company_name: z.string().min(1),
    country: CountryCodeSchema,
    city: z.string().min(1).optional(),
    contact_person: z.string().min(1),
    role: z.string().min(1).optional(),
    email: z.string().email().optional(),
    website: z.string().url().optional(),
    company_evidence_status: z.enum(["needs_screening", "screened", "insufficient_evidence"]),
  }),
  purchase_intent: z.array(AccioPurchaseIntentSchema).min(1),
  negotiated_prices: z.array(z.object({
    product: z.string().min(1),
    quoted_price_usd: z.number().positive().optional(),
    target_price_usd: z.number().positive().optional(),
    agreed_or_best_price_usd: z.number().positive().optional(),
    currency: z.string().min(1).default("USD"),
    notes: z.string().min(1).optional(),
  })).default([]),
  negotiation_summary: z.string().min(1),
  next_actions: z.array(z.string().min(1)).min(1),
  behavior_signals: AccioBehaviorSignalsSchema.optional(),
  source_references: z.array(z.object({
    source_type: SourceTypeSchema,
    source_file: z.string().min(1),
    conversation_id: z.string().min(1),
  })).min(1),
});

export type LeadCandidate = z.infer<typeof LeadCandidateSchema>;
export type InvestigationTarget = z.infer<typeof InvestigationTargetSchema>;
export type ScoreBlock = z.infer<typeof ScoreBlockSchema>;
export type ScreeningReport = z.infer<typeof ScreeningReportSchema>;
export type AccioChatExport = z.infer<typeof AccioChatExportSchema>;
export type AccioChatSummary = z.infer<typeof AccioChatSummarySchema>;
export type ContextualScoreResult = z.infer<typeof ContextualScoreResultSchema>;

function round(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function calculateContextualScore(params: {
  profile?: string;
  blocks: ScoreBlock[];
  forcedDowngrades?: string[];
}): ContextualScoreResult {
  const blocks = z.array(ScoreBlockSchema).parse(params.blocks);
  const forcedDowngrades = params.forcedDowngrades ?? [];
  const applicableBlocks = blocks.filter((block) => block.status !== "not_applicable");
  const scoredBlocks = blocks.filter((block) => block.status === "scored");

  const rawScore = scoredBlocks.reduce((sum, block) => sum + (block.earned_points ?? 0), 0);
  const scoreDenominator = scoredBlocks.reduce((sum, block) => sum + block.max_points, 0);
  const coverageDenominator = applicableBlocks.reduce((sum, block) => sum + block.max_points, 0);
  const evidenceCoverage = coverageDenominator === 0 ? 0 : scoreDenominator / coverageDenominator;
  const normalizedScore = scoreDenominator === 0 ? null : (rawScore / scoreDenominator) * 100;

  let riskTier: z.infer<typeof RiskTierSchema>;
  if (forcedDowngrades.length > 0) {
    riskTier = "high_risk";
  } else if (scoreDenominator === 0 || evidenceCoverage < 0.4) {
    riskTier = "insufficient_evidence";
  } else if (normalizedScore !== null && normalizedScore < 55) {
    riskTier = "high_risk";
  } else if (normalizedScore !== null && normalizedScore >= 75 && evidenceCoverage >= 0.7) {
    riskTier = "trusted_candidate";
  } else {
    riskTier = "cautious";
  }

  return ContextualScoreResultSchema.parse({
    profile: params.profile ?? "phase1_contextual",
    normalized_score: normalizedScore === null ? null : round(normalizedScore),
    evidence_coverage: round(evidenceCoverage, 4),
    risk_tier: riskTier,
    raw_score: round(rawScore),
    score_denominator: round(scoreDenominator),
    coverage_denominator: round(coverageDenominator),
    forced_downgrades: forcedDowngrades,
    blocks,
  });
}
