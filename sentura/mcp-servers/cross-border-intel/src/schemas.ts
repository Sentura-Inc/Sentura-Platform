import { z } from "zod";

export const SOURCE_TYPES = [
  "official_api",
  "official_registry_page",
  "public_web",
  "public_dns",
  "paid_trade_data",
  "demo_fixture",
  "self_reported",
  "unverified",
] as const;

export const EVIDENCE_STATUSES = [
  "scored",
  "not_applicable",
  "unavailable_api",
  "disabled_by_budget",
  "pending_human_input",
] as const;

export const SCORE_BLOCKS = [
  "legal_identity",
  "domain_email",
  "public_footprint",
  "business_fit",
  "trade_financial",
  "conversation_behavior",
] as const;

export const RISK_TIERS = [
  "trusted_candidate",
  "cautious",
  "insufficient_evidence",
  "high_risk",
] as const;

export const SourceTypeSchema = z.enum(SOURCE_TYPES);
export const EvidenceStatusSchema = z.enum(EVIDENCE_STATUSES);
export const ScoreBlockIdSchema = z.enum(SCORE_BLOCKS);
export const RiskTierSchema = z.enum(RISK_TIERS);

export const CountryCodeSchema = z
  .string()
  .regex(/^[A-Z]{2}$/, "Expected ISO 3166-1 alpha-2 country code");

export const ConfidenceSchema = z.number().min(0).max(1);
export const IsoTimestampSchema = z.string().datetime({ offset: true });

export const SourceEnvelopeShape = {
  source_url: z.string().min(1),
  source_type: SourceTypeSchema,
  fetched_at: IsoTimestampSchema,
  confidence: ConfidenceSchema,
};

export const ScoreBlockSchema = z
  .object({
    block: ScoreBlockIdSchema,
    status: EvidenceStatusSchema,
    max_points: z.number().positive(),
    earned_points: z.number().min(0).nullable().optional(),
    source_count: z.number().int().min(0).optional(),
    summary: z.string().min(1).optional(),
    reason: z.string().min(1).optional(),
  })
  .superRefine((block, ctx) => {
    if (block.status !== "scored") return;
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

export type ScoreBlock = z.infer<typeof ScoreBlockSchema>;
export type ContextualScoreResult = z.infer<typeof ContextualScoreResultSchema>;

export const CompanyRegistrySearchInputShape = {
  company_name: z.string().min(2),
  country: CountryCodeSchema.optional(),
  max_results: z.number().int().min(1).max(20).default(5),
};

export const CompanyProfileInputShape = {
  registry: z.enum(["companies_house", "opencorporates", "manual_url"]).default("companies_house"),
  country: CountryCodeSchema.optional(),
  company_number: z.string().min(1).optional(),
  registry_url: z.string().url().optional(),
};

export const DomainRdapLookupInputShape = {
  domain: z.string().min(3),
};

export const EmailDomainCheckInputShape = {
  email: z.string().email().optional(),
  domain: z.string().min(3).optional(),
  enable_paid_validation: z.boolean().default(false),
};

export const SecLookupInputShape = {
  cik: z.string().regex(/^\d{1,10}$/, "CIK must be numeric and at most 10 digits"),
};

export const TradeRecordSearchInputShape = {
  company_name: z.string().min(2),
  country: CountryCodeSchema.optional(),
  product_keywords: z.array(z.string().min(1)).default([]),
  source: z.enum(["auto", "volza", "importyeti", "public_web"]).default("auto"),
  max_records: z.number().int().min(1).max(50).default(10),
  max_paid_spend_usd: z.number().min(0).default(0),
};

export const ScoreBuyerInputShape = {
  profile: z.string().min(1).default("phase1_contextual"),
  blocks: z.array(ScoreBlockSchema).min(1),
  forced_downgrades: z.array(z.string().min(1)).default([]),
};

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
  packaging: z.string().min(1).optional(),
  target_price_usd: z.number().positive().optional(),
  seller_best_price_usd: z.number().positive().optional(),
  packaging_addon_usd: z.number().min(0).optional(),
  incoterm: z.string().min(1).optional(),
  payment_terms: z.string().min(1).optional(),
  logistics_terms: z.string().min(1).optional(),
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
  negotiated_prices: z
    .array(
      z.object({
        product: z.string().min(1),
        quoted_price_usd: z.number().positive().optional(),
        target_price_usd: z.number().positive().optional(),
        agreed_or_best_price_usd: z.number().positive().optional(),
        currency: z.string().min(1).default("USD"),
        notes: z.string().min(1).optional(),
      }),
    )
    .default([]),
  negotiation_summary: z.string().min(1),
  next_actions: z.array(z.string().min(1)).min(1),
  behavior_signals: z
    .object({
      inquiry_professionalism_points: z.number().min(0).max(10),
      responsiveness_points: z.number().min(0).max(10),
      notes: z.string().min(1),
    })
    .optional(),
  source_references: z
    .array(
      z.object({
        source_type: SourceTypeSchema,
        source_file: z.string().min(1),
        conversation_id: z.string().min(1),
      }),
    )
    .min(1),
});

export const ParseAccioChatInputShape = {
  chat_export: AccioChatExportSchema,
};

export const SummarizeAccioChatInputShape = {
  chat_export: AccioChatExportSchema,
  conversation_id: z.string().min(1).optional(),
};

export type AccioChatExport = z.infer<typeof AccioChatExportSchema>;
export type AccioConversation = z.infer<typeof AccioConversationSchema>;
export type AccioChatSummary = z.infer<typeof AccioChatSummarySchema>;

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
