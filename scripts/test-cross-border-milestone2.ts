#!/usr/bin/env tsx
/**
 * Cross-border e-commerce Milestone 2 structural test.
 *
 * Run: npx tsx scripts/test-cross-border-milestone2.ts
 *
 * This does not call live APIs, a gateway, or an LLM. It verifies the shared
 * fixture, ontology, schemas, and contextual scoring rules required before
 * the MCP server and employee workspaces are built.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import JSON5 from "../openclaw/node_modules/json5/lib/index.js";
import {
  AccioChatExportSchema,
  AccioChatSummarySchema,
  LeadCandidateSchema,
  ScreeningReportSchema,
  calculateContextualScore,
  type ScoreBlock,
} from "../sentura/lib/cross-border-ecommerce.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ONTOLOGY_DIR = path.join(ROOT, "sentura/config/industry-ontologies/cross-border-mobile-accessories");
const FIXTURE = path.join(ROOT, "跨境电商/fixtures/accio-chat-records.sample.json");

let passed = 0;
let failed = 0;
const failures: string[] = [];

function read(file: string): string {
  return fs.readFileSync(file, "utf8");
}

function readJson5(rel: string): any {
  return JSON5.parse(read(path.join(ONTOLOGY_DIR, rel)));
}

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
    passed++;
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
    failures.push(label);
  }
}

function section(title: string) {
  console.log(`\n\x1b[1m━━━ ${title} ━━━\x1b[0m`);
}

section("Fixture and Accio schema");
const accioFixture = JSON.parse(read(FIXTURE));
const accioExport = AccioChatExportSchema.parse(accioFixture);
check("Accio fixture parses with AccioChatExportSchema", accioExport.conversations.length >= 3);
check("Accio fixture records T2/T3 business data classification", /T[23]/.test(accioExport.export_metadata.data_classification));
check(
  "Accio fixture covers multiple buyer regions",
  new Set(accioExport.conversations.map((conversation) => conversation.buyer.country)).size >= 3,
);

const accioSummarySample = AccioChatSummarySchema.parse({
  conversation_id: "accio_conv_001",
  customer_profile: {
    company_name: "Andes Mobile Parts SpA",
    country: "CL",
    city: "Santiago",
    contact_person: "Maria Torres",
    role: "Purchasing Manager",
    email: "purchasing@andesmobileparts.cl",
    website: "https://andesmobileparts.cl",
    company_evidence_status: "needs_screening",
  },
  purchase_intent: [
    {
      product: "tempered glass screen protector",
      models: ["iPhone 15", "Samsung S24"],
      quantity: 10000,
      packaging: "custom retail packaging with buyer brand",
      target_price_usd: 0.35,
      seller_best_price_usd: 0.36,
      packaging_addon_usd: 0.03,
      incoterm: "FOB Shenzhen",
      payment_terms: "T/T 30% deposit, balance before shipment",
    },
  ],
  negotiated_prices: [
    {
      product: "tempered glass screen protector",
      quoted_price_usd: 0.38,
      target_price_usd: 0.35,
      agreed_or_best_price_usd: 0.36,
      notes: "Packaging addon USD 0.03 per piece.",
    },
  ],
  negotiation_summary: "Buyer accepted PI request after seller countered USD 0.36 plus packaging addon.",
  next_actions: ["Prepare PI.", "Send packaging artwork requirements.", "Send to Screening."],
  behavior_signals: {
    inquiry_professionalism_points: 8,
    responsiveness_points: 7,
    notes: "Specific products, models, volume, Incoterm, payment terms, and packaging requirements supplied.",
  },
  source_references: [
    {
      source_type: "demo_fixture",
      source_file: "accio-chat-records.sample.json",
      conversation_id: "accio_conv_001",
    },
  ],
});
check("AccioChatSummarySchema accepts product/price/terms summary", accioSummarySample.purchase_intent[0]?.quantity === 10000);

section("Ontology files");
const taxonomy = readJson5("assets/product-taxonomy.json5");
const scoringRules = readJson5("rules/scoring-rules.json5");
const leadSop = readJson5("workflows/lead-discovery-sop.json5");
const screeningSop = readJson5("workflows/buyer-screening-sop.json5");

for (const rel of [
  "README.md",
  "assets/product-taxonomy.json5",
  "rules/scoring-rules.json5",
  "workflows/lead-discovery-sop.json5",
  "workflows/buyer-screening-sop.json5",
]) {
  check(`${rel} exists`, fs.existsSync(path.join(ONTOLOGY_DIR, rel)));
}

const categoryIds = taxonomy.categories.map((category: any) => category.id);
for (const category of [
  "phone-cases",
  "screen-protectors",
  "chargers",
  "cables",
  "mobile-holders",
  "power-accessories",
  "repair-accessories",
]) {
  check(`product taxonomy includes ${category}`, categoryIds.includes(category));
}

check("taxonomy includes required buyer personas", ["importer", "distributor", "wholesaler", "repair chain", "marketplace seller"].every((persona) => taxonomy.buyerPersonas.includes(persona)));
check("taxonomy carries marketplace exclusions", ["amazon.com", "alibaba.com", "aliexpress.com", "temu.com", "ebay.com"].every((domain) => taxonomy.excludedSupplierMarketplaces.includes(domain)));
check("lead SOP prohibits automatic outreach", JSON.stringify(leadSop).includes("Do not send cold outreach automatically"));
check("screening SOP accepts manual input", screeningSop.entities[0]?.attributes?.acceptedInputs?.includes("manual_input"));

section("Contextual scoring ontology");
const blockIds = scoringRules.evidenceBlocks.map((block: any) => block.id);
for (const block of ["legal_identity", "domain_email", "public_footprint", "business_fit", "trade_financial", "conversation_behavior"]) {
  check(`scoring rules define ${block}`, blockIds.includes(block));
}
const statusRules = scoringRules.scoringModel.blockStatuses;
check(
  "not_applicable is excluded from score and coverage denominators",
  statusRules.some((entry: any) => entry.status === "not_applicable" && entry.inScoreDenominator === false && entry.inCoverageDenominator === false),
);
check(
  "disabled_by_budget counts as coverage gap only",
  statusRules.some((entry: any) => entry.status === "disabled_by_budget" && entry.inScoreDenominator === false && entry.inCoverageDenominator === true),
);
check(
  "conversation_behavior cold lead default is not_applicable",
  scoringRules.evidenceBlocks.some((block: any) => block.id === "conversation_behavior" && block.coldLeadDefaultStatus === "not_applicable"),
);
check(
  "trade_financial default unavailable status is disabled_by_budget",
  scoringRules.evidenceBlocks.some((block: any) => block.id === "trade_financial" && block.defaultUnavailableStatus === "disabled_by_budget"),
);

section("Lead and screening schemas");
const lead = LeadCandidateSchema.parse({
  lead_id: "lead_20260608_0001",
  source_run_id: "lead-run-2026-06-08-us-gb",
  company_name: "Example Mobile Distribution Ltd",
  website: "https://example-mobile-distribution.co.uk",
  domain: "example-mobile-distribution.co.uk",
  country: "GB",
  city: "Manchester",
  buyer_type: "distributor",
  matched_products: ["phone case", "screen protector"],
  contact_candidates: [
    {
      type: "email",
      value: "sales@example-mobile-distribution.co.uk",
      source_url: "https://example-mobile-distribution.co.uk/contact",
      confidence: 0.74,
    },
  ],
  source_urls: ["https://example-mobile-distribution.co.uk"],
  discovery_evidence: [
    {
      signal: "website_mentions_mobile_accessories",
      source_url: "https://example-mobile-distribution.co.uk/products",
      excerpt: "Wholesale mobile accessories and repair parts",
      confidence: 0.82,
      fetched_at: "2026-06-08T00:00:00Z",
    },
  ],
  dedupe_key: "example-mobile-distribution.co.uk",
  created_at: "2026-06-08T00:00:00Z",
});
check("LeadCandidateSchema accepts design-shaped lead", lead.dedupe_key === "example-mobile-distribution.co.uk");

const coldLeadBlocks: ScoreBlock[] = [
  { block: "legal_identity", status: "scored", max_points: 25, earned_points: 19, source_count: 2 },
  { block: "domain_email", status: "scored", max_points: 25, earned_points: 20, source_count: 3 },
  { block: "public_footprint", status: "scored", max_points: 20, earned_points: 15, source_count: 4 },
  { block: "business_fit", status: "scored", max_points: 20, earned_points: 15, source_count: 2 },
  {
    block: "trade_financial",
    status: "disabled_by_budget",
    max_points: 10,
    earned_points: null,
    reason: "Volza/ImportYeti key not enabled for this demo run",
  },
  {
    block: "conversation_behavior",
    status: "not_applicable",
    max_points: 15,
    earned_points: null,
    reason: "Cold lead from Marketing; no Accio or sales conversation yet",
  },
];

const coldLeadScore = calculateContextualScore({
  profile: "cold_lead_low_cost",
  blocks: coldLeadBlocks,
});
check("cold lead score excludes conversation_behavior from denominator", coldLeadScore.coverage_denominator === 100);
check("disabled paid APIs reduce evidence coverage", coldLeadScore.evidence_coverage === 0.9);
check("disabled paid APIs do not reduce normalized score", coldLeadScore.normalized_score === 76.67);
check("cold lead risk tier is trusted_candidate", coldLeadScore.risk_tier === "trusted_candidate");

const withoutPaidGapScore = calculateContextualScore({
  profile: "cold_lead_low_cost_no_paid_gap",
  blocks: coldLeadBlocks.filter((block) => block.block !== "trade_financial"),
});
check("removing disabled trade block preserves normalized score", withoutPaidGapScore.normalized_score === coldLeadScore.normalized_score);
check("removing disabled trade block improves coverage", withoutPaidGapScore.evidence_coverage === 1);

const forcedDowngradeScore = calculateContextualScore({
  profile: "forced_downgrade",
  blocks: coldLeadBlocks,
  forcedDowngrades: ["free_or_disposable_email_only"],
});
check("forced downgrade overrides otherwise good score", forcedDowngradeScore.risk_tier === "high_risk");

const screeningReport = ScreeningReportSchema.parse({
  report_id: "screen_20260608_0001",
  lead_id: lead.lead_id,
  target_source: "marketing_lead",
  company_name: lead.company_name,
  risk_tier: coldLeadScore.risk_tier,
  normalized_score: coldLeadScore.normalized_score,
  evidence_coverage: coldLeadScore.evidence_coverage,
  recommended_action: "试探接触，要求对方使用公司域名邮箱确认需求，并补充公司注册号或采购历史。",
  score_blocks: coldLeadBlocks,
  evidence: [
    {
      layer: "domain_email",
      source_type: "public_dns",
      source: "DNS MX/TXT/RDAP",
      finding: "Domain has MX and SPF evidence in the demo sample.",
      score_block: "domain_email",
      score_impact: "positive",
      confidence: 0.8,
      fetched_at: "2026-06-08T00:00:00Z",
    },
  ],
  open_questions: ["未找到可验证的海关记录；如需提高证据覆盖率，可启用付费贸易数据。"],
  missing_or_unavailable_evidence: [
    {
      block: "trade_financial",
      status: "disabled_by_budget",
      recommended_next_step: "如需提高证据覆盖率，可为此客户启用一次 Volza Buyer Insights。",
    },
  ],
  created_at: "2026-06-08T00:00:00Z",
});
check("ScreeningReportSchema accepts contextual score report", screeningReport.evidence_coverage === 0.9);

console.log(`\nResult: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`Failures: ${failures.join(", ")}`);
  process.exit(1);
}
