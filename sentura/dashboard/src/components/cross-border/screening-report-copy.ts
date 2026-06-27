type EvidenceCopyInput = {
  layer?: string;
  sourceType?: string;
  scoreBlock?: string;
  scoreImpact?: string;
  confidence?: number;
  finding?: string;
  sourceUrl?: string;
};

type ScoreBlockCopyInput = {
  block?: string;
  status?: string;
  summary?: string;
  reason?: string;
};

const blockLabels: Record<string, string> = {
  legal_identity: "公司注册与线下门店/地址",
  domain_email: "官网和邮箱",
  google_maps_local_presence: "线下地址",
  address_validation: "地址一致性",
  public_footprint: "公开资料",
  business_fit: "业务匹配",
  trade_financial: "贸易和财务公开信息",
  conversation_behavior: "聊天行为",
};

const layerLabels: Record<string, string> = {
  legal_registry: "公司注册信息",
  domain_rdap: "域名登记信息",
  email_dns: "邮箱设置",
  official_contact: "官网公开联系信息",
  google_maps_local_presence: "线下地址",
  address_validation: "地址一致性",
  public_footprint: "公开网页资料",
  trade_customs: "贸易记录",
  financial_public_filing: "财务公开信息",
  accio_behavior: "聊天行为",
};

const sourceTypeLabels: Record<string, string> = {
  legal_registry: "官方注册资料",
  official_registry_page: "官方注册资料",
  official_api: "官方公开资料",
  domain_rdap: "域名登记资料",
  email_dns: "邮箱设置资料",
  public_dns: "域名解析资料",
  official_contact: "官网资料",
  google_maps_places: "Google Maps（谷歌地图）公开地址",
  google_maps_local_presence: "Google Maps（谷歌地图）公开地址",
  address_validation: "公开地址资料",
  public_web: "公开网页",
  trade_customs: "贸易资料",
  financial_public_filing: "财务公开资料",
  accio_behavior: "聊天记录",
  unverified: "待补充来源",
};

const businessStatusLabels: Record<string, string> = {
  OPERATIONAL: "营业中",
  CLOSED_TEMPORARILY: "暂停营业",
  CLOSED_PERMANENTLY: "已关闭",
};

const properNounReplacements: Array<[RegExp, string]> = [
  [/\bGoogle Maps\b(?!（谷歌地图）)/g, "Google Maps（谷歌地图）"],
  [/\bSEC\b(?!（美国证券交易委员会）)/g, "SEC（美国证券交易委员会）"],
  [/\bRDAP\b(?!（域名登记信息）)/gi, "RDAP（域名登记信息）"],
  [/\bDNS\b(?!（域名解析）)/gi, "DNS（域名解析）"],
  [/\bMX\b/g, "收信设置"],
  [/\bSPF\b/g, "发信设置"],
  [/\bDMARC\b/g, "邮件安全设置"],
  [/\bKYB\b/gi, "企业核验"],
];

const technicalCopyReplacements: Array<[RegExp, string]> = [
  [/外部可追溯证据 URL/g, "来源网址"],
  [/可追溯证据 URL/g, "来源网址"],
  [/来源 URL/g, "来源网址"],
  [/证据 URL/g, "来源网址"],
  [/工具返回(?:的)?来源链接/g, "来源网址"],
  [/工具返回(?:的)?关键结果摘要/g, "公开资料摘要"],
  [/工具返回/g, "公开资料显示"],
  [/工具查询/g, "公开核验"],
  [/查询返回/g, "公开资料显示"],
  [/查询权限错误/g, "暂时无法核验"],
  [/工具权限异常/g, "暂时无法核验"],
  [/\bAPI authorization failure\b/gi, "资料源暂时不可用"],
  [/\bapi_error\b/gi, "资料源暂时不可用"],
  [/\bAPI\b/g, "资料源"],
  [/\bJSON\b/g, "结构化资料"],
  [/\bHTTP \d{3}\b/gi, "资料源状态"],
  [/\bendpoint\b/gi, "资料入口"],
  [/\bprovider\b/gi, "资料源"],
  [/\bobjectClassName\b/g, "对象类型"],
  [/\bself link\b/gi, "来源链接"],
  [/\blookup\b/gi, "核验"],
  [/\bquery\b/gi, "检索条件"],
  [/\bqueries\b/gi, "检索条件"],
  [/\bredirected\b/gi, "跳转"],
  [/\breturned\b/gi, "显示"],
  [/\braw response\b/gi, "公开资料"],
  [/\bpayload\b/gi, "公开资料"],
  [/\binvalid_mailbox\b/gi, "邮箱不可达"],
  [/\bundeliverable\b/gi, "邮箱不可达"],
];

const englishPhraseReplacements: Array<[RegExp, string]> = [
  [/\bname_match\b/gi, "名称匹配"],
  [/\bdomain_match\b/gi, "官网匹配"],
  [/\bphone_match\b/gi, "电话匹配"],
  [/\baddress_match\b/gi, "地址匹配"],
  [/\bcategory_match\b/gi, "经营类别匹配"],
  [/\bcity_match\b/gi, "城市匹配"],
  [/\bcountry_match\b/gi, "国家匹配"],
  [/\bwebsite_match\b/gi, "官网匹配"],
  [/\bofficial website\b/gi, "官网"],
  [/\bofficial contact\b/gi, "官网公开联系信息"],
  [/\bweb_search\b/gi, "公开网页资料"],
  [/\blegal registry\b/gi, "公司注册信息"],
  [/\bcompany registry\b/gi, "公司注册信息"],
  [/\bdomain registration data\b/gi, "域名登记资料"],
  [/\bdomain registration\b/gi, "域名登记信息"],
  [/\bdomain\b/gi, "域名"],
  [/\bemail\b/gi, "邮箱"],
  [/\bprovider details\b/gi, "相关信息"],
  [/\bpublic footprint\b/gi, "公开资料"],
  [/\bbusiness fit\b/gi, "业务匹配"],
  [/\btrade customs\b/gi, "贸易/海关记录"],
  [/\bfinancial filing\b/gi, "财务公开文件"],
  [/\bcompany website\b/gi, "公司官网"],
  [/\bprivate company\b/gi, "非上市公司"],
  [/\bfor this\b/gi, "针对该"],
  [/\bnot found\b/gi, "未找到"],
  [/\bno result(?:s)?\b/gi, "未找到结果"],
  [/\bfound\b/gi, "已找到"],
  [/\bverified\b/gi, "已核验"],
  [/\bunverified\b/gi, "待核验"],
  [/\bunavailable\b/gi, "未找到可用信息"],
  [/\bnot applicable\b/gi, "不适用"],
  [/\binsufficient evidence\b/gi, "证据不足"],
  [/\bhigh risk\b/gi, "风险较高"],
  [/\bcautious\b/gi, "谨慎跟进"],
  [/\btrusted candidate\b/gi, "可信候选"],
  [/\bfollow up\b/gi, "继续跟进"],
  [/\bproceed\b/gi, "继续推进"],
  [/\breview\b/gi, "复核"],
  [/\bconfidence\b/gi, "可信度"],
  [/\bevidence\b/gi, "依据"],
  [/\bsource\b/gi, "来源"],
];

const forbiddenTechnicalTerms =
  /\b(API|HTTP|JSON|token|payload|endpoint|provider|lookup|query|returned|raw response|field_mask|cross-border-intel|tool)\b|工具|接口|返回|原始响应|原始结果|结构化资料|资料源状态|检索条件/i;

const allowedEnglishTokens = new Set([
  "google",
  "maps",
  "sec",
  "rdap",
  "dns",
  "mx",
  "spf",
  "dmarc",
  "kyb",
  "inc",
  "llc",
  "ltd",
  "limited",
  "corp",
  "corporation",
  "co",
  "company",
  "gmbh",
  "ag",
  "ab",
  "bv",
  "sas",
  "sa",
  "plc",
]);

function hasChinese(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function isMostlyEnglish(value: string) {
  const letters = (value.match(/[A-Za-z]/g) ?? []).length;
  const chinese = (value.match(/[\u3400-\u9fff]/g) ?? []).length;
  return letters > 28 && chinese < 8;
}

function hasUnsupportedEnglish(value: string) {
  const withoutUrls = value
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\b[A-Za-z0-9.-]+\.[A-Za-z]{2,}\S*/g, " ");
  const words = withoutUrls.match(/[A-Za-z][A-Za-z0-9_-]{2,}/g) ?? [];
  return words.some((word) => !allowedEnglishTokens.has(word.toLowerCase()));
}

function isCleanChineseReportText(value: string) {
  return hasChinese(value) && !forbiddenTechnicalTerms.test(value) && !isMostlyEnglish(value) && !hasUnsupportedEnglish(value);
}

function cleanWhitespace(value: string) {
  return value.replace(/\s+/g, " ").replace(/\s+([，。；：、])/g, "$1").trim();
}

function applyPlainReplacements(value: string) {
  let next = value;
  for (const [pattern, replacement] of properNounReplacements) next = next.replace(pattern, replacement);
  for (const [pattern, replacement] of technicalCopyReplacements) next = next.replace(pattern, replacement);
  for (const [pattern, replacement] of englishPhraseReplacements) next = next.replace(pattern, replacement);
  return cleanWhitespace(next);
}

function fallbackForEnglishText(value: string, fallback?: string) {
  const lower = value.toLowerCase();
  if (/\b(high risk|do not|avoid|negative|suspicious)\b/.test(lower)) {
    return fallback ?? "发现需要复核的风险信息，建议暂缓跟进，先核对来源网址。";
  }
  if (/\b(cautious|review|insufficient|not found|unavailable|no result)\b/.test(lower)) {
    return fallback ?? "目前依据还不充分，建议结合来源网址复核后再决定是否跟进。";
  }
  if (/\b(trusted|verified|positive|found|proceed|follow up)\b/.test(lower)) {
    return fallback ?? "已找到可参考的信息，可继续跟进，但仍建议结合来源网址复核。";
  }
  return fallback ?? "已按中文范式整理该报告项；请结合来源网址查看原始页面。";
}

export function simplifyScreeningReportText(value: string | null | undefined, fallback?: string) {
  if (!value) return value ?? fallback;
  const cleaned = applyPlainReplacements(value);
  if (!cleaned) return fallback;
  if (isMostlyEnglish(cleaned) || forbiddenTechnicalTerms.test(cleaned)) {
    return fallbackForEnglishText(cleaned, fallback);
  }
  return cleaned;
}

export function publicSourceUrl(value: string | null | undefined) {
  if (!value || !/^https?:\/\//i.test(value)) return null;
  if (/^https?:\/\/sentura\.local\//i.test(value)) return null;
  return value;
}

export function confidenceText(confidence: number | undefined) {
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) return "可信度待确认";
  const percent = Math.round(confidence * 100);
  if (confidence >= 0.8) return `可信度较高（${percent}%）`;
  if (confidence >= 0.55) return `可信度中等（${percent}%）`;
  return `可信度较低（${percent}%），需要人工复核`;
}

export function sourceTypeText(value: string | undefined) {
  if (!value) return null;
  return sourceTypeLabels[value] ?? null;
}

export function businessStatusText(value: string | undefined) {
  if (!value) return null;
  return businessStatusLabels[value] ?? simplifyScreeningReportText(value, "状态待确认");
}

export function reportSourceTopic(input: EvidenceCopyInput) {
  const key = input.layer ?? input.scoreBlock ?? input.sourceType ?? "";
  return layerLabels[key] ?? blockLabels[key] ?? sourceTypeText(input.sourceType) ?? "对应信息";
}

export function screeningEvidenceFindingText(input: EvidenceCopyInput) {
  const topic = reportSourceTopic(input);
  const hasSource = Boolean(publicSourceUrl(input.sourceUrl));
  const confidence = confidenceText(input.confidence);
  const plainFinding = simplifyScreeningReportText(input.finding, "") ?? "";
  const findingIsUseful = Boolean(plainFinding && isCleanChineseReportText(plainFinding));
  const alreadyStandardFinding = Boolean(
    findingIsUseful &&
      /^(已找到|未找到|暂未找到)/.test(plainFinding) &&
      /(可信度|需要人工复核|来源网址)/.test(plainFinding),
  );

  if (alreadyStandardFinding) return plainFinding;

  if (!hasSource) {
    return `未找到可核验的${topic}来源网址。${confidence}。`;
  }
  if (input.scoreImpact === "negative") {
    return `已找到与${topic}相关的风险信息。${confidence}。${findingIsUseful ? `摘要：${plainFinding}` : "建议结合来源网址人工复核。"}`;
  }
  if (input.scoreImpact === "coverage_only") {
    return `已找到可参考的${topic}。${confidence}。${findingIsUseful ? `摘要：${plainFinding}` : "该信息仅用于补充判断。"}`;
  }
  return `已找到${topic}。${confidence}。${findingIsUseful ? `摘要：${plainFinding}` : "请结合来源网址复核具体内容。"}`;
}

export function screeningScoreBlockText(input: ScoreBlockCopyInput) {
  const topic = blockLabels[input.block ?? ""] ?? "这一项";
  const text = simplifyScreeningReportText(input.summary ?? input.reason, "") ?? "";
  if (text && isCleanChineseReportText(text)) return text;
  if (input.status === "scored") return `${topic}已找到可用依据，并已纳入评分。`;
  if (input.status === "not_applicable") return `${topic}本次不适用，不影响判断。`;
  if (input.status === "disabled_by_budget") return `${topic}需要付费资料，本次未启用。`;
  if (input.status === "unavailable_api") return `${topic}本次未找到可用资料，需要人工补充来源后复核。`;
  return `${topic}还缺少足够依据，需要补充后再判断。`;
}
