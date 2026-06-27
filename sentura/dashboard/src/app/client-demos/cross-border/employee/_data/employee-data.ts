export type CustomerStatus =
  | "not_started"
  | "running"
  | "screened"
  | "insufficient_evidence"
  | "failed";

export type ScoreTier = "high" | "medium" | "low";
export type ScreeningRiskTier = "trusted_candidate" | "cautious" | "insufficient_evidence" | "high_risk";
export type ScreeningEvidenceStatus =
  | "scored"
  | "not_applicable"
  | "unavailable_api"
  | "disabled_by_budget"
  | "pending_human_input";
export type ScreeningScoreImpact = "positive" | "negative" | "neutral" | "coverage_only";
export type ScreeningEvidenceLayer =
  | "legal_registry"
  | "domain_rdap"
  | "email_dns"
  | "official_contact"
  | "google_maps_local_presence"
  | "address_validation"
  | "public_footprint"
  | "trade_customs"
  | "financial_public_filing"
  | "accio_behavior";

export const MAX_LEAD_TARGET_COUNT = 20;

export interface CustomerScoreBlock {
  block: string;
  status: ScreeningEvidenceStatus;
  maxPoints: number;
  earnedPoints?: number | null;
  sourceCount?: number;
  summary?: string;
  reason?: string;
}

export interface CustomerEvidenceItem {
  layer: ScreeningEvidenceLayer;
  sourceUrl: string;
  sourceType?: string;
  fetchedAt?: string;
  finding: string;
  confidence?: number;
  scoreBlock?: string;
  scoreImpact?: ScreeningScoreImpact;
  affectsScore?: boolean;
  costPosture?: string;
}

export interface CustomerCoverageGap {
  block: string;
  reason: string;
  action?: string;
}

export type AddressFootprintCoverageStatus =
  | "found"
  | "partial"
  | "not_found"
  | "unavailable_api"
  | "not_checked";

export type AddressFootprintAddressType =
  | "headquarters_or_office"
  | "storefront"
  | "warehouse_or_distribution"
  | "service_or_repair_location"
  | "unknown_business_location";

export type AddressFootprintRelationshipStatus =
  | "confirmed_company_location"
  | "probable_company_location"
  | "possible_related_location"
  | "rejected_unrelated_location";

export interface AddressFootprintValidation {
  status?: string;
  addressComplete?: boolean;
  possibleNextAction?: string;
}

export interface AddressFootprintLocation {
  googlePlaceId?: string;
  displayName: string;
  addressType: AddressFootprintAddressType;
  relationshipStatus: AddressFootprintRelationshipStatus;
  formattedAddress: string;
  city?: string;
  region?: string;
  country?: string;
  businessStatus?: string;
  types: string[];
  websiteUri?: string;
  domainMatch?: boolean | "not_checked";
  phoneMatch?: boolean | "not_checked" | "conflict";
  addressValidation?: AddressFootprintValidation;
  googleMapsUri?: string;
  matchConfidence?: number;
  matchReasons: string[];
  sourceType?: string;
  fetchedAt?: string;
}

export interface CustomerAddressFootprint {
  sectionTitle: string;
  coverageStatus: AddressFootprintCoverageStatus;
  searchScope: {
    queriesRun: string[];
    countries: string[];
    capped: boolean;
    limitations: string[];
  };
  summary: {
    totalLocations: number;
    confirmedLocations: number;
    probableLocations: number;
    possibleRelatedLocations: number;
    operationalLocations: number;
    closedLocations: number;
    countries: string[];
    cities: string[];
  };
  locations: AddressFootprintLocation[];
  openQuestions: string[];
}

export type CompanyScaleClass =
  | "listed_or_public"
  | "medium_large_registered"
  | "small_local_offline"
  | "small_online_only"
  | "unknown_scale";

export type CompanyScaleFirstBlockStrategy =
  | "registry_disclosure_primary_maps_support"
  | "maps_physical_address_primary"
  | "domain_public_source_primary"
  | "try_registry_and_maps";

export interface CompanyScaleAssessment {
  scaleClass: CompanyScaleClass;
  confidence?: number;
  rationale: string;
  firstBlockStrategy: CompanyScaleFirstBlockStrategy;
}

export interface CustomerScreeningReport {
  reportId: string;
  riskTier: ScreeningRiskTier;
  normalizedScore?: number | null;
  evidenceCoverage?: number;
  recommendedAction: string;
  createdAt?: string;
  companyScaleAssessment?: CompanyScaleAssessment;
  scoreBlocks: CustomerScoreBlock[];
  evidence: CustomerEvidenceItem[];
  coverageGaps: CustomerCoverageGap[];
  addressFootprint?: CustomerAddressFootprint;
  openQuestions?: string[];
}

export interface CustomerListItem {
  customerId: string;
  source: "lead_discovery" | "manual_screening" | "accio_handoff";
  companyName: string;
  country: string;
  countryName: string;
  city?: string;
  buyerType: string;
  products: string[];
  website?: string;
  foundAt: string;
  screeningStatus: CustomerStatus;
  normalizedScore?: number;
  scoreTier?: ScoreTier;
  reportId?: string;
  leadAgentRunId?: string;
  screeningAgentRunId?: string;
  latestAgentRunId?: string;
  sourceUrls: string[];
  evidenceSummary: string;
  recommendedAction?: string;
  screeningReport?: CustomerScreeningReport;
}

export function coverageGapReasonForBlock(block: string, status?: ScreeningEvidenceStatus) {
  if (status === "disabled_by_budget") {
    return "付费贸易、邮箱或外部资料源未启用，未查询该付费资料。";
  }
  if (status === "unavailable_api") {
    return "本次未找到可用结果，报告未提供更具体原因。";
  }
  if (status === "not_applicable") {
    return "该客户当前没有适用的数据输入，不参与本次评分。";
  }
  if (status === "pending_human_input") {
    return "报告未提供这一项可核验依据，需要人工补充或重新背调。";
  }
  switch (block) {
    case "legal_identity":
      return "公司注册信息、官方注册页或可确认的 Google Maps（谷歌地图）线下门店/地址未形成足够真实性证据。";
    case "domain_email":
      return "官网域名、邮箱记录或邮箱验证未搜索到足够依据。";
    case "public_footprint":
      return "公开网页或线下地址线索未找到足够业务足迹。";
    case "business_fit":
      return "公开页面未确认产品、渠道或买家画像匹配。";
    case "trade_financial":
      return "贸易记录或财务公开信息未搜索到可用结果。";
    case "conversation_behavior":
      return "没有聊天或销售对话记录可用于行为判断。";
    default:
      return "本次未找到可用结果；报告未提供更具体原因。";
  }
}

export function coverageGapActionForBlock(block: string, status?: ScreeningEvidenceStatus) {
  if (status === "disabled_by_budget") return "开启对应付费来源或提高单次预算后重新背调。";
  if (status === "unavailable_api") return "人工补充可核验的来源网址后重新复核。";
  if (status === "not_applicable") return "如后续产生聊天或销售记录，可再补充行为依据。";
  switch (block) {
    case "legal_identity":
      return "补充公司注册号、法定名称、官方注册地区，或提供门店/办公地址线索后重新查询。";
    case "domain_email":
      return "补充官网域名、业务邮箱或联系人邮箱后重新验证。";
    case "trade_financial":
      return "开启贸易/财务数据源，或补充进口商名称、注册号后重新搜索。";
    case "conversation_behavior":
      return "导入聊天记录或销售跟进记录后再评估。";
    default:
      return undefined;
  }
}

export function coverageGapsFromScoreBlocks(blocks: CustomerScoreBlock[]): CustomerCoverageGap[] {
  return blocks
    .filter((block) => block.status !== "scored")
    .map((block) => ({
      block: block.block,
      reason: block.reason?.trim() || coverageGapReasonForBlock(block.block, block.status),
      action: coverageGapActionForBlock(block.block, block.status),
    }));
}

export function isGenericCoverageGapReason(reason: string | undefined) {
  const normalized = reason?.trim();
  return !normalized || normalized === "缺少该维度证据。" || normalized === "缺少该维度证据";
}

export type MemoryStatus = "not_started" | "running" | "analyzed" | "failed";

export interface MemoryRecordItem {
  recordId: string;
  name: string;
  source: "accio" | "alibaba_international" | "manual_import" | "demo_data" | "other";
  importedAt: string;
  analysisStatus: MemoryStatus;
  conversationCount: number;
  reportId?: string;
  latestAgentRunId?: string;
  memoryPreviewStatus: "preview_only" | "approved" | "rejected";
  summary: string;
  handoffCompany?: string;
  supplementCustomerId?: string;
  supplementCompanyName?: string;
  supplementSource?: CustomerListItem["source"];
}

export interface CostBudget {
  period: "month";
  limitUsd: number;
  warningRatio: number;
  hardStopRatio: number;
}

export interface LeadProductOption {
  id: string;
  label: string;
  keyword: string;
  description: string;
}

export interface LeadBuyerTypeOption {
  id: string;
  label: string;
  keyword: string;
  description: string;
}

export interface LeadCountryOption {
  code: string;
  label: string;
  language: string;
  description: string;
}

export interface LeadExcludeDomainOption {
  id: string;
  label: string;
  description: string;
  domains: string[];
}

export interface TaskEstimate {
  label: string;
  estimatedUsd: number;
  details: string;
  source?: string;
}

export const employeeProfile = {
  name: "林悦",
  role: "员工",
  tenant: "跨境电商",
  userToken:
    process.env.NEXT_PUBLIC_SENTURA_EMPLOYEE_TOKEN ??
    process.env.NEXT_PUBLIC_SENTURA_ADMIN_TOKEN ??
    "cross-border-employee-demo",
};

export const leadProductOptions: LeadProductOption[] = [
  {
    id: "phone-case",
    label: "手机壳",
    keyword: "phone case",
    description: "寻找采购手机保护壳、保护套的买家。",
  },
  {
    id: "tempered-glass",
    label: "钢化膜",
    keyword: "tempered glass screen protector",
    description: "寻找采购手机屏幕保护膜的买家。",
  },
  {
    id: "usb-c-charger",
    label: "充电器",
    keyword: "USB-C charger",
    description: "寻找采购充电器、数据线等电源配件的买家。",
  },
  {
    id: "magsafe",
    label: "MagSafe 配件",
    keyword: "MagSafe accessories",
    description: "寻找采购磁吸支架、磁吸充电等配件的买家。",
  },
  {
    id: "repair-parts",
    label: "维修配件",
    keyword: "mobile phone repair parts",
    description: "寻找采购屏幕、排线、电池等维修件的买家。",
  },
];

export const leadBuyerTypeOptions: LeadBuyerTypeOption[] = [
  {
    id: "repair-chain",
    label: "维修连锁",
    keyword: "mobile phone repair chain",
    description: "有线下门店或维修服务网络，通常采购维修件和保护类产品。",
  },
  {
    id: "electronics-retailer",
    label: "电子零售商",
    keyword: "electronics retailer",
    description: "销售手机、电子产品或配件的零售公司。",
  },
  {
    id: "accessory-retailer",
    label: "配件零售商",
    keyword: "cell phone accessories retailer",
    description: "主营手机壳、膜、充电器等配件的零售商。",
  },
  {
    id: "cell-phone-store",
    label: "手机门店",
    keyword: "cell phone store",
    description: "本地手机门店或门店型经销商。",
  },
  {
    id: "reseller",
    label: "转售采购商",
    keyword: "electronics reseller buyer",
    description: "面向下游渠道转售的采购商。",
  },
  {
    id: "importer",
    label: "进口采购商",
    keyword: "mobile accessories importer buyer",
    description: "有进口或批发采购特征的公司。",
  },
];

export const leadCountryOptions: LeadCountryOption[] = [
  { code: "GB", label: "英国", language: "en", description: "优先查公司主体和官网线索。" },
  { code: "US", label: "美国", language: "en", description: "优先查官网、州注册和财务公开线索。" },
  { code: "DE", label: "德国", language: "de", description: "适合电子零售和配件渠道。" },
  { code: "FR", label: "法国", language: "fr", description: "适合法语市场渠道搜索。" },
  { code: "BR", label: "巴西", language: "pt", description: "适合维修配件和本地渠道搜索。" },
  { code: "MX", label: "墨西哥", language: "es", description: "适合拉美零售和维修渠道搜索。" },
];

export const leadExcludeDomainOptions: LeadExcludeDomainOption[] = [
  {
    id: "marketplaces",
    label: "跨境平台",
    description: "排除平台页，保留真实公司官网。",
    domains: ["amazon.com", "alibaba.com", "aliexpress.com", "temu.com", "ebay.com"],
  },
  {
    id: "social",
    label: "社媒主页",
    description: "排除只有社媒主页、无法确认公司的页面。",
    domains: ["facebook.com", "instagram.com", "linkedin.com", "x.com", "tiktok.com"],
  },
  {
    id: "directories",
    label: "目录/榜单",
    description: "排除黄页、名单页和泛目录结果。",
    domains: ["yelp.com", "yellowpages.com", "trustpilot.com", "clutch.co"],
  },
  {
    id: "supplier-directories",
    label: "供应商目录",
    description: "排除供应侧目录，避免找到卖家而不是买家。",
    domains: ["globalsources.com", "made-in-china.com", "dhgate.com"],
  },
];

export const monthlyCostBudget: CostBudget = {
  period: "month",
  limitUsd: 120,
  warningRatio: 0.8,
  hardStopRatio: 1,
};

export const costEstimateAssumptions = {
  sourceLabel: "近期实际费用记录",
  leadSourceLabel: "近期实际费用记录",
  leadDiscovery: {
    minimumUsd: 0.12,
    observedBaseUsd: 0.1,
    observedSearchRequestUsd: 0.025,
    observedRetainedCandidateUsd: 0.006,
    observedSafetyMultiplier: 1.1,
    openAiGpt55InputPerMillionUsd: 5,
    openAiGpt55CachedInputPerMillionUsd: 0.5,
    openAiGpt55OutputPerMillionUsd: 30,
    modelBaseInputTokens: 6000,
    modelInputTokensPerSearch: 4000,
    modelInputTokensPerFetchedPage: 600,
    modelBaseOutputTokens: 1200,
    modelOutputTokensPerCandidate: 450,
    promptCacheRatio: 0.35,
    tavilyAdvancedSearchRequestUsd: 0.016,
    retainedCandidateReviewUsd: 0.0015,
    safetyMultiplier: 1.15,
  },
  screening: {
    minimumUsd: 0.18,
    observedBaseUsd: 0.2,
    observedTargetUsd: 0.1,
    observedSafetyMultiplier: 1.15,
    openAiGpt55InputPerMillionUsd: 5,
    openAiGpt55CachedInputPerMillionUsd: 0.5,
    openAiGpt55OutputPerMillionUsd: 30,
    modelBaseInputTokens: 4500,
    modelInputTokensPerTarget: 3800,
    modelOutputTokensPerTarget: 1500,
    promptCacheRatio: 0.3,
    tavilyAdvancedSearchRequestUsd: 0.016,
    publicSearchRequestsPerTarget: 2,
    abstractEmailReputationRequestUsd: 17 / 5000,
    hunterVerificationCreditUsd: 49 / 2000,
    paidTradeDataExpectedUsd: 0,
  },
  memory: {
    minimumUsd: 0.12,
    baseUsd: 0.1,
    conversationUsd: 0.06,
  },
};

function reportBlocks(overrides: Partial<Record<string, Partial<CustomerScoreBlock>>> = {}): CustomerScoreBlock[] {
  const base: CustomerScoreBlock[] = [
    { block: "legal_identity", status: "scored", maxPoints: 25, earnedPoints: 20, sourceCount: 1, summary: "公司主体或官方来源已核验。" },
    { block: "domain_email", status: "scored", maxPoints: 25, earnedPoints: 21, sourceCount: 2, summary: "官网和邮箱信号基本稳定。" },
    { block: "public_footprint", status: "scored", maxPoints: 20, earnedPoints: 16, sourceCount: 2, summary: "公开网页与业务画像匹配。" },
    { block: "business_fit", status: "scored", maxPoints: 20, earnedPoints: 18, sourceCount: 2, summary: "产品和渠道与手机配件采购匹配。" },
    { block: "trade_financial", status: "unavailable_api", maxPoints: 10, earnedPoints: null, sourceCount: 0, reason: "贸易或财务资料未启用或未命中。" },
    { block: "conversation_behavior", status: "not_applicable", maxPoints: 15, earnedPoints: null, sourceCount: 0, reason: "冷启动找客户记录没有聊天行为数据。" },
  ];
  return base.map((block) => ({ ...block, ...(overrides[block.block] ?? {}) }));
}

function coverageGaps(...reasons: string[]): CustomerCoverageGap[] {
  return reasons.map((reason, index) => ({
    block: `gap-${index + 1}`,
    reason,
  }));
}

export const customerRows: CustomerListItem[] = [
  {
    customerId: "cust-mobile-lab",
    source: "lead_discovery",
    companyName: "Mobile Lab UK",
    country: "GB",
    countryName: "英国",
    city: "London",
    buyerType: "repair chain",
    products: ["phone case", "tempered glass"],
    website: "https://mobilelab.example",
    foundAt: "2026-06-14 09:18",
    screeningStatus: "screened",
    normalizedScore: 84,
    scoreTier: "high",
    reportId: "screen-mobile-lab-001",
    latestAgentRunId: "run-screen-20260614-0918",
    sourceUrls: ["https://mobilelab.example/about", "https://mobilelab.example/repairs"],
    evidenceSummary: "官网、门店页和同域邮箱均能对应维修连锁画像。",
    recommendedAction: "加入高优先级跟进名单，补充采购联系人后进入报价。",
    screeningReport: {
      reportId: "screen-mobile-lab-001",
      riskTier: "trusted_candidate",
      normalizedScore: 84,
      evidenceCoverage: 0.82,
      createdAt: "2026-06-14 09:27",
      recommendedAction: "加入高优先级跟进名单，补充采购联系人后进入报价。",
      scoreBlocks: reportBlocks({
        legal_identity: { earnedPoints: 22, summary: "公开主体信息与门店页一致。" },
        domain_email: { earnedPoints: 23, summary: "官网域名、同域联系邮箱和 DNS 信号稳定。" },
        public_footprint: { earnedPoints: 17, summary: "官网、维修服务页和公开搜索结果能证明业务存在。" },
        business_fit: { earnedPoints: 19, summary: "门店维修和配件销售与目标产品高度匹配。" },
        trade_financial: { status: "pending_human_input", earnedPoints: null, reason: "缺少进口记录或采购记录线索。" },
      }),
      evidence: [
        {
          layer: "legal_registry",
          sourceUrl: "https://find-and-update.company-information.service.gov.uk/search/companies?q=Mobile%20Lab%20UK",
          sourceType: "official_registry_page",
          finding: "英国公司主体需要以 Companies House 或官方公开页复核，当前记录保留官方搜索入口。",
          confidence: 0.72,
          scoreBlock: "legal_identity",
          scoreImpact: "positive",
          affectsScore: true,
          costPosture: "免费公开来源",
        },
        {
          layer: "domain_rdap",
          sourceUrl: "https://rdap.org/domain/mobilelab.example",
          sourceType: "official_api",
          finding: "官网域名信息用于确认网站归属与稳定性。",
          confidence: 0.66,
          scoreBlock: "domain_email",
          scoreImpact: "positive",
          affectsScore: true,
          costPosture: "免费公开来源",
        },
        {
          layer: "email_dns",
          sourceUrl: "https://mobilelab.example",
          sourceType: "public_dns",
          finding: "同域邮箱与企业官网一致，未发现一次性邮箱信号。",
          confidence: 0.84,
          scoreBlock: "domain_email",
          scoreImpact: "positive",
          affectsScore: true,
          costPosture: "免费 DNS 查询",
        },
        {
          layer: "official_contact",
          sourceUrl: "https://mobilelab.example/about",
          sourceType: "public_web",
          finding: "官网页面展示维修服务和联系入口，可作为后续采购联系人核验入口。",
          confidence: 0.78,
          scoreBlock: "public_footprint",
          scoreImpact: "positive",
          affectsScore: true,
          costPosture: "公开网页",
        },
        {
          layer: "public_footprint",
          sourceUrl: "https://mobilelab.example/repairs",
          sourceType: "public_web",
          finding: "维修服务页与手机壳、钢化膜、维修配件采购画像匹配。",
          confidence: 0.82,
          scoreBlock: "business_fit",
          scoreImpact: "positive",
          affectsScore: true,
          costPosture: "公开网页",
        },
      ],
      coverageGaps: coverageGaps(
        "未取得可直接归属到该主体的贸易/海关记录。",
        "未取得财务公开信息；英国私营或非美上市主体应以 Companies House/本地公开财务来源复核。",
        "未提供聊天或销售对话记录，行为信号不计入分母。",
      ),
      openQuestions: ["补充采购联系人邮箱。", "确认是否有近期进口或批发采购记录。"],
    },
  },
  {
    customerId: "cust-nordic-accessories",
    source: "lead_discovery",
    companyName: "Nordic Accessories AB",
    country: "SE",
    countryName: "瑞典",
    city: "Stockholm",
    buyerType: "distributor",
    products: ["USB-C charger", "cable"],
    website: "https://nordic-accessories.example",
    foundAt: "2026-06-13 15:40",
    screeningStatus: "running",
    latestAgentRunId: "run-screen-20260614-1040",
    sourceUrls: ["https://nordic-accessories.example/catalog"],
    evidenceSummary: "已找到官网和产品目录，背调员工正在核验注册信息。",
    recommendedAction: "等待背调完成后再进入商务联系。",
  },
  {
    customerId: "cust-mex-retail",
    source: "manual_screening",
    companyName: "Tecno Retail MX",
    country: "MX",
    countryName: "墨西哥",
    city: "Guadalajara",
    buyerType: "retailer",
    products: ["screen protector", "phone case"],
    website: "https://tecno-retail.example",
    foundAt: "2026-06-12 11:06",
    screeningStatus: "screened",
    normalizedScore: 61,
    scoreTier: "medium",
    reportId: "screen-tecno-mx-002",
    latestAgentRunId: "run-screen-20260612-1106",
    sourceUrls: ["https://tecno-retail.example/contact"],
    evidenceSummary: "公开页面不足，缺少注册号或可信同域联系人。",
    recommendedAction: "谨慎跟进；补充公司注册号或公司邮箱后提高评分。",
    screeningReport: {
      reportId: "screen-tecno-mx-002",
      riskTier: "cautious",
      normalizedScore: 61,
      evidenceCoverage: 0.38,
      createdAt: "2026-06-12 11:06",
      recommendedAction: "谨慎跟进；补充公司注册号或公司邮箱后提高评分。",
      scoreBlocks: reportBlocks({
        legal_identity: { status: "pending_human_input", earnedPoints: null, sourceCount: 0, reason: "缺少注册号或可确认法律主体的官方来源。" },
        domain_email: { earnedPoints: 12, summary: "官网可访问，但缺少可信同域联系人。" },
        public_footprint: { earnedPoints: 10, summary: "公开足迹较少，仅能证明基础网页存在。" },
        business_fit: { earnedPoints: 13, summary: "产品方向与手机配件相关，但公开页面证据不足。" },
        trade_financial: { status: "disabled_by_budget", earnedPoints: null, reason: "贸易/海关记录未启用。" },
      }),
      evidence: [
        {
          layer: "official_contact",
          sourceUrl: "https://tecno-retail.example/contact",
          sourceType: "public_web",
          finding: "公开联系页存在，但缺少同域采购邮箱和可交叉验证联系人。",
          confidence: 0.46,
          scoreBlock: "domain_email",
          scoreImpact: "neutral",
          affectsScore: true,
          costPosture: "公开网页",
        },
        {
          layer: "public_footprint",
          sourceUrl: "https://tecno-retail.example/contact",
          sourceType: "public_web",
          finding: "公开页面能够证明基础网站存在，但不足以确认采购规模和主体真实性。",
          confidence: 0.42,
          scoreBlock: "public_footprint",
          scoreImpact: "neutral",
          affectsScore: true,
          costPosture: "公开网页",
        },
      ],
      coverageGaps: coverageGaps(
        "缺少公司注册号或官方注册页。",
        "缺少公司邮箱，无法触发付费邮箱验证。",
        "贸易/海关数据未启用，不能作为负面证据。",
        "未取得财务公开信息；墨西哥私营或非美国申报主体应补充本地注册/税务主体资料。",
        "未提供聊天或销售对话记录。",
      ),
      openQuestions: ["要求客户补充注册主体/RFC。", "要求客户用公司域名邮箱回复。"],
    },
  },
  {
    customerId: "cust-accio-br",
    source: "accio_handoff",
    companyName: "Brasil Cell Parts",
    country: "BR",
    countryName: "巴西",
    city: "Sao Paulo",
    buyerType: "来自聊天记录",
    products: ["OLED screen", "repair parts"],
    foundAt: "2026-06-11 17:22",
    screeningStatus: "not_started",
    latestAgentRunId: "run-accio-20260611-1722",
    sourceUrls: ["accio-chat-records.sample.json"],
    evidenceSummary: "来自聊天记录整理，已有价格和数量线索，尚未做主体背调。",
    recommendedAction: "点击开始调研，先核验公司主体和官网。",
  },
  {
    customerId: "cust-low-risk",
    source: "lead_discovery",
    companyName: "Case Outlet Direct",
    country: "US",
    countryName: "美国",
    city: "Austin",
    buyerType: "e-commerce seller",
    products: ["phone case"],
    website: "https://case-outlet.example",
    foundAt: "2026-06-10 08:55",
    screeningStatus: "screened",
    normalizedScore: 44,
    scoreTier: "low",
    reportId: "screen-case-outlet-003",
    latestAgentRunId: "run-screen-20260610-0855",
    sourceUrls: ["https://case-outlet.example"],
    evidenceSummary: "官网信息薄弱，销售渠道与采购画像不稳定。",
    recommendedAction: "低优先级，仅在补充贸易记录后再判断。",
    screeningReport: {
      reportId: "screen-case-outlet-003",
      riskTier: "high_risk",
      normalizedScore: 44,
      evidenceCoverage: 0.55,
      createdAt: "2026-06-10 08:55",
      recommendedAction: "低优先级，仅在补充贸易记录后再判断。",
      scoreBlocks: reportBlocks({
        legal_identity: { earnedPoints: 7, summary: "未能稳定对应法律主体。" },
        domain_email: { earnedPoints: 8, summary: "域名和联系信息较弱。" },
        public_footprint: { earnedPoints: 8, summary: "公开足迹薄弱。" },
        business_fit: { earnedPoints: 12, summary: "有手机壳相关页面，但采购角色不清晰。" },
        trade_financial: { status: "unavailable_api", earnedPoints: null, reason: "未命中可用贸易/财务记录。" },
      }),
      evidence: [
        {
          layer: "public_footprint",
          sourceUrl: "https://case-outlet.example",
          sourceType: "public_web",
          finding: "官网内容较少，无法确认稳定采购规模或明确进口/批发身份。",
          confidence: 0.35,
          scoreBlock: "public_footprint",
          scoreImpact: "negative",
          affectsScore: true,
          costPosture: "公开网页",
        },
        {
          layer: "trade_customs",
          sourceUrl: "https://www.google.com/search?q=Case%20Outlet%20Direct%20import%20shipment%20phone%20case",
          sourceType: "public_web",
          finding: "未找到能直接归属到目标公司的进口或海关记录。",
          confidence: 0.22,
          scoreBlock: "trade_financial",
          scoreImpact: "coverage_only",
          affectsScore: false,
          costPosture: "公开网页弱证据",
        },
      ],
      coverageGaps: coverageGaps(
        "缺少稳定法律主体证据。",
        "缺少同域采购邮箱。",
        "未命中贸易/海关记录，建议人工确认后再投入销售资源。",
        "未命中财务公开信息；若对方不是上市申报主体，此项只能作为待补充内容，不能直接作为负面结论。",
      ),
      openQuestions: ["要求客户提供公司注册资料。", "确认是否为终端买家而非小型零售站点。"],
    },
  },
];

export const memoryRows: MemoryRecordItem[] = [
  {
    recordId: "mem-accio-001",
    name: "Brasil Cell Parts - 聊天记录",
    source: "accio",
    importedAt: "2026-06-11 17:12",
    analysisStatus: "analyzed",
    conversationCount: 3,
    reportId: "accio-summary-001",
    latestAgentRunId: "run-accio-20260611-1722",
    memoryPreviewStatus: "preview_only",
    summary: "提取了 OLED 屏、维修配件、目标价和下一步报价动作。",
    handoffCompany: "Brasil Cell Parts",
  },
  {
    recordId: "mem-ali-002",
    name: "阿里国际站询盘 - 充电器批发",
    source: "alibaba_international",
    importedAt: "2026-06-13 10:30",
    analysisStatus: "running",
    conversationCount: 2,
    latestAgentRunId: "run-accio-20260613-1030",
    memoryPreviewStatus: "preview_only",
    summary: "正在提取产品、数量、目标价和物流条款。",
  },
  {
    recordId: "mem-manual-003",
    name: "线下展会名片记录",
    source: "manual_import",
    importedAt: "2026-06-14 08:44",
    analysisStatus: "not_started",
    conversationCount: 1,
    memoryPreviewStatus: "preview_only",
    summary: "已导入客户描述，等待分析后生成整理预览。",
  },
];

export const employeeMessages = [
  {
    id: "msg-lead-done",
    title: "获客任务完成：找到 18 个潜在客户",
    time: "09:27",
    target: "获客与背调",
  },
  {
    id: "msg-screening-gap",
    title: "背调证据不足：Tecno Retail MX 需要补充公司邮箱",
    time: "昨天",
    target: "客户报告",
  },
  {
    id: "msg-accio-done",
    title: "聊天记录分析完成：3 个客户记录已整理",
    time: "6月11日",
    target: "记忆整理",
  },
];

export const leadTaskEstimate = {
  label: "寻找客户",
  estimatedUsd: 0.35,
  details: "按当前公开资料查询价格和近期实际任务用量估算；不是已发生账单。",
  source: costEstimateAssumptions.leadSourceLabel,
};

export const screeningTaskEstimate = {
  label: "批量背调",
  estimatedUsd: 0.45,
  details: "默认只按模型和公开证据查询估算；邮箱/贸易付费项单独追加。",
  source: costEstimateAssumptions.sourceLabel,
};

export const memoryTaskEstimate = {
  label: "记忆分析",
  estimatedUsd: 0.18,
  details: "按近期聊天记录整理任务估算；不是已发生账单。",
  source: costEstimateAssumptions.sourceLabel,
};

export function estimateLeadTaskCost({
  productCount,
  buyerTypeCount,
  countryCount,
  targetCount,
  maxResultsPerQuery,
}: {
  productCount: number;
  buyerTypeCount: number;
  countryCount: number;
  targetCount: number;
  maxResultsPerQuery: number;
}): TaskEstimate {
  const safeProductCount = Math.max(1, productCount);
  const safeBuyerTypeCount = Math.max(1, buyerTypeCount);
  const safeCountryCount = Math.max(1, countryCount);
  const rawTargetCount = Math.floor(targetCount);
  const safeTargetCount = Number.isFinite(rawTargetCount)
    ? Math.min(MAX_LEAD_TARGET_COUNT, Math.max(1, rawTargetCount))
    : 1;
  const safeMaxResultsPerQuery = Math.max(1, maxResultsPerQuery);
  const queryCount = safeProductCount * safeBuyerTypeCount * safeCountryCount;
  const searchUnits = queryCount * safeMaxResultsPerQuery;
  const assumptions = costEstimateAssumptions.leadDiscovery;
  const expectedRetainedPerSearch = Math.max(1, Math.min(6, Math.ceil(safeMaxResultsPerQuery * 0.35)));
  const estimatedSearchRequestCount = Math.max(
    1,
    Math.min(queryCount, Math.ceil(safeTargetCount / expectedRetainedPerSearch)),
  );
  const estimatedFetchedPages = Math.min(searchUnits, estimatedSearchRequestCount * safeMaxResultsPerQuery, safeTargetCount * 3);
  const searchRequestUsd = estimatedSearchRequestCount * assumptions.tavilyAdvancedSearchRequestUsd;
  const retainedCandidateUsd =
    Math.min(safeTargetCount, searchUnits) * assumptions.retainedCandidateReviewUsd;
  const pricedExternalUsd = searchRequestUsd + retainedCandidateUsd;
  const observedUsd =
    (assumptions.observedBaseUsd +
      estimatedSearchRequestCount * assumptions.observedSearchRequestUsd +
      Math.min(safeTargetCount, searchUnits) * assumptions.observedRetainedCandidateUsd) *
    assumptions.observedSafetyMultiplier;
  const estimatedUsd = Number(
    Math.max(
      assumptions.minimumUsd,
      observedUsd,
      pricedExternalUsd,
    ).toFixed(2),
  );
  return {
    label: "寻找客户",
    estimatedUsd,
    source: costEstimateAssumptions.leadSourceLabel,
    details: `${safeProductCount} 类产品、${safeBuyerTypeCount} 类买家、${safeCountryCount} 个国家；最多 ${queryCount} 组搜索组合，目标上限 ${MAX_LEAD_TARGET_COUNT} 个客户。按近期实际找客户费用校准，并与外部资料查询下限取较高值。预计会读取约 ${estimatedFetchedPages} 个公开页面；实际费用以任务完成后的费用记录为准。`,
  };
}

export function estimateScreeningTaskCost({
  targetCount,
  paidEmailValidation = false,
  paidTradeData = false,
  maxPaidSpendUsd = 0,
}: {
  targetCount: number;
  paidEmailValidation?: boolean;
  paidTradeData?: boolean;
  maxPaidSpendUsd?: number;
}): TaskEstimate {
  const assumptions = costEstimateAssumptions.screening;
  const safeTargetCount = Math.max(1, Math.floor(targetCount));
  const estimatedInputTokens =
    assumptions.modelBaseInputTokens +
    safeTargetCount * assumptions.modelInputTokensPerTarget;
  const cachedInputTokens = Math.round(estimatedInputTokens * assumptions.promptCacheRatio);
  const uncachedInputTokens = estimatedInputTokens - cachedInputTokens;
  const estimatedOutputTokens = safeTargetCount * assumptions.modelOutputTokensPerTarget;
  const modelUsd =
    (uncachedInputTokens / 1_000_000) * assumptions.openAiGpt55InputPerMillionUsd +
    (cachedInputTokens / 1_000_000) * assumptions.openAiGpt55CachedInputPerMillionUsd +
    (estimatedOutputTokens / 1_000_000) * assumptions.openAiGpt55OutputPerMillionUsd;
  const publicSearchCount = safeTargetCount * assumptions.publicSearchRequestsPerTarget;
  const publicSearchUsd = publicSearchCount * assumptions.tavilyAdvancedSearchRequestUsd;
  const emailValidationUsd = paidEmailValidation
    ? safeTargetCount * (assumptions.abstractEmailReputationRequestUsd + assumptions.hunterVerificationCreditUsd)
    : 0;
  const tradeDataBudgetCapUsd = paidTradeData ? Math.max(0, maxPaidSpendUsd) : 0;
  const tradeDataExpectedUsd = paidTradeData
    ? Math.min(tradeDataBudgetCapUsd, safeTargetCount * assumptions.paidTradeDataExpectedUsd)
    : 0;
  const itemizedUsd = modelUsd + publicSearchUsd + emailValidationUsd + tradeDataExpectedUsd;
  const observedUsd =
    (assumptions.observedBaseUsd + safeTargetCount * assumptions.observedTargetUsd) *
    assumptions.observedSafetyMultiplier;
  const estimatedUsd = Number(
    Math.max(
      assumptions.minimumUsd,
      itemizedUsd,
      observedUsd,
    ).toFixed(2),
  );
  const enabled = [
    paidEmailValidation ? "邮箱验证" : null,
    paidTradeData ? `贸易数据硬上限 US$${tradeDataBudgetCapUsd.toFixed(2)}（不当作预计支出）` : null,
  ].filter(Boolean);
  return {
    label: safeTargetCount > 1 ? "批量背调" : "单个背调",
    estimatedUsd,
    source: costEstimateAssumptions.sourceLabel,
    details: `${safeTargetCount} 个客户：按近期实际背调费用校准，并与公开查询、邮箱验证等查询费用取较高值。${paidEmailValidation ? `邮箱验证预计约 US$${emailValidationUsd.toFixed(2)}。` : "未启用邮箱付费验证。"}${enabled.length ? ` 已启用：${enabled.join("、")}。` : " 不预留外部付费数据。"}贸易数据额度只作为硬上限，不代表一定会花完；实际费用以任务完成后的费用记录为准。`,
  };
}

export function estimateMemoryTaskCost(conversationCount: number): TaskEstimate {
  const assumptions = costEstimateAssumptions.memory;
  const safeConversationCount = Math.max(1, conversationCount);
  const estimatedUsd = Number(
    Math.max(assumptions.minimumUsd, assumptions.baseUsd + safeConversationCount * assumptions.conversationUsd).toFixed(2),
  );
  return {
    label: "记忆分析",
    estimatedUsd,
    source: costEstimateAssumptions.sourceLabel,
    details: `按基础 US$${assumptions.baseUsd.toFixed(2)} + ${safeConversationCount} 条对话 × US$${assumptions.conversationUsd.toFixed(2)} 估算；这是预算预估，不是已发生账单。`,
  };
}
