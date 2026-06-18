"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Copy,
  ClipboardCheck,
  Database,
  Eye,
  Globe2,
  Link2,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { AgentChat, type AgentChatHandle, type ChatMessage, type ToolCallEvent } from "@/components/agent-chat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAgent, useGateway } from "@/lib/gateway";
import { cn } from "@/lib/utils";

const LEAD_AGENT_ID = "cbe-lead-discovery";
const LEAD_TASK_PREFIX = "[CBE Lead Discovery Employee Task]";
const LEADS_JSON_START = "LEAD_CANDIDATES_JSON_START";
const LEADS_JSON_END = "LEAD_CANDIDATES_JSON_END";

type SourceType =
  | "official_api"
  | "public_web"
  | "paid_trade_data"
  | "self_reported"
  | "unverified";

interface ProductOption {
  id: string;
  label: string;
  keyword: string;
}

interface PersonaOption {
  id: string;
  label: string;
  keyword: string;
}

interface CountryOption {
  code: string;
  label: string;
  language: string;
}

interface ContactCandidate {
  type: "email" | "contact_form" | "social_profile" | "person";
  value: string;
  source_url: string;
  confidence: number;
}

interface DiscoveryEvidence {
  signal: string;
  source_url: string;
  excerpt: string;
  confidence: number;
  query: string;
  fetched_at: string;
  source_type: SourceType;
}

interface LeadCandidate {
  lead_id: string;
  source_run_id: string;
  company_name: string;
  website: string;
  domain: string;
  country: string;
  city: string;
  buyer_type: string;
  matched_products: string[];
  contact_candidates: ContactCandidate[];
  source_urls: string[];
  discovery_evidence: DiscoveryEvidence[];
  dedupe_key: string;
  duplicate_status: "new" | "possible_duplicate" | "duplicate";
  created_at: string;
  source_label: string;
  discovery_confidence: number;
  dedupe_explanation: string;
}

interface EnvProviderStatus {
  configured?: boolean;
  enabled?: boolean;
  no_api_key_required?: boolean;
  user_agent_configured?: boolean;
  provider?: string;
}

interface LeadRunEnvStatus {
  tavily_search?: EnvProviderStatus;
  companies_house?: EnvProviderStatus;
  abstract_email_validation?: EnvProviderStatus;
  hunter_enrichment?: EnvProviderStatus;
  importyeti_trade_data?: EnvProviderStatus;
  sec_edgar?: EnvProviderStatus;
  paid_trade_data?: {
    enabled?: boolean;
    max_paid_spend_usd?: number;
  };
  request_timeout_ms?: number;
}

interface LeadDiscoveryStoredState {
  selectedProductIds: string[];
  selectedPersonaIds: string[];
  selectedCountryCodes: string[];
  targetCount: number;
  maxResultsPerQuery: number;
  excludeDomains: string;
  customKeyword: string;
  leads: LeadCandidate[];
  expandedLeadId?: string;
  envStatus?: LeadRunEnvStatus;
  runStatus: "idle" | "running" | "ready" | "error";
  runMessage: string;
  leadSessionKey?: string;
}

const LEAD_DISCOVERY_STORAGE_KEY = "sentura:cbe:lead-discovery:v1";

const productOptions: ProductOption[] = [
  { id: "phone-case", label: "手机壳", keyword: "phone case" },
  { id: "tempered-glass", label: "钢化膜", keyword: "tempered glass screen protector" },
  { id: "usb-c-charger", label: "充电器", keyword: "USB-C charger" },
  { id: "magsafe", label: "MagSafe 配件", keyword: "MagSafe accessories" },
  { id: "repair-parts", label: "维修配件", keyword: "mobile phone repair parts" },
];

const personaOptions: PersonaOption[] = [
  { id: "repair-chain", label: "维修连锁", keyword: "mobile phone repair chain" },
  { id: "electronics-retailer", label: "电子零售商", keyword: "electronics retailer" },
  { id: "accessory-retailer", label: "配件零售商", keyword: "cell phone accessories retailer" },
  { id: "cell-phone-store", label: "手机门店", keyword: "cell phone store" },
  { id: "reseller", label: "转售采购商", keyword: "electronics reseller buyer" },
  { id: "importer", label: "进口采购商", keyword: "mobile accessories importer buyer" },
];

const countryOptions: CountryOption[] = [
  { code: "GB", label: "英国", language: "en" },
  { code: "US", label: "美国", language: "en" },
  { code: "DE", label: "德国", language: "de" },
  { code: "FR", label: "法国", language: "fr" },
  { code: "BR", label: "巴西", language: "pt" },
  { code: "MX", label: "墨西哥", language: "es" },
];

const sourceTypeLabels: Record<SourceType, string> = {
  official_api: "官方 API",
  public_web: "公开网页",
  paid_trade_data: "付费贸易数据",
  self_reported: "自报信息",
  unverified: "未验证",
};

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function buildRunId() {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  return `lead-run-${day}-live`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeSourceType(value: unknown): SourceType {
  if (
    value === "official_api" ||
    value === "public_web" ||
    value === "paid_trade_data" ||
    value === "self_reported" ||
    value === "unverified"
  ) {
    return value;
  }
  return "public_web";
}

function normalizeContactCandidate(value: unknown): ContactCandidate | undefined {
  const raw = asRecord(value);
  const type = asString(raw.type);
  const contactType =
    type === "email" || type === "contact_form" || type === "social_profile" || type === "person"
      ? type
      : undefined;
  const candidate: ContactCandidate = {
    type: contactType ?? "person",
    value: asString(raw.value) ?? asString(raw.email) ?? asString(raw.name) ?? "",
    source_url: asString(raw.source_url) ?? asString(raw.url) ?? "",
    confidence: asNumber(raw.confidence, 0.4),
  };
  return candidate.value ? candidate : undefined;
}

function normalizeDiscoveryEvidence(value: unknown, fallbackSourceUrl: string, fallbackQuery: string): DiscoveryEvidence {
  const raw = asRecord(value);
  const sourceUrl = asString(raw.source_url) ?? asString(raw.url) ?? fallbackSourceUrl;
  return {
    signal: asString(raw.signal) ?? asString(raw.title) ?? "public_web_candidate_signal",
    source_url: sourceUrl,
    excerpt: asString(raw.excerpt) ?? asString(raw.summary) ?? asString(raw.snippet) ?? "公开网页显示该公司与目标买家画像相关。",
    confidence: asNumber(raw.confidence, 0.55),
    query: asString(raw.query) ?? fallbackQuery,
    fetched_at: asString(raw.fetched_at) ?? new Date().toISOString(),
    source_type: normalizeSourceType(raw.source_type),
  };
}

function domainFromWebsite(website: string): string {
  try {
    const url = website.includes("://") ? new URL(website) : new URL(`https://${website}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? website;
  }
}

function normalizeLeadCandidate(value: unknown, index: number, runId: string, fallbackQuery: string): LeadCandidate | undefined {
  const raw = asRecord(value);
  const companyName = asString(raw.company_name) ?? asString(raw.name);
  const website = asString(raw.website) ?? asString(raw.url);
  const domain = asString(raw.domain) ?? (website ? domainFromWebsite(website) : undefined);
  const country = asString(raw.country);
  if (!companyName || !website || !domain || !country) return undefined;

  const sourceUrls = asStringArray(raw.source_urls);
  if (sourceUrls.length === 0) sourceUrls.push(website);
  const evidenceSource = sourceUrls[0] ?? website;
  const discoveryEvidence = Array.isArray(raw.discovery_evidence)
    ? raw.discovery_evidence.map((item) => normalizeDiscoveryEvidence(item, evidenceSource, fallbackQuery))
    : [];
  if (discoveryEvidence.length === 0) {
    discoveryEvidence.push(normalizeDiscoveryEvidence(raw, evidenceSource, fallbackQuery));
  }
  const contacts = Array.isArray(raw.contact_candidates)
    ? raw.contact_candidates.map(normalizeContactCandidate).filter((item): item is ContactCandidate => Boolean(item))
    : [];
  const confidence =
    typeof raw.discovery_confidence === "number"
      ? raw.discovery_confidence
      : Math.min(0.95, Math.max(0.35, discoveryEvidence.reduce((total, item) => total + item.confidence, 0) / discoveryEvidence.length));
  const leadId =
    asString(raw.lead_id) ??
    `lead_${runId.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "")}_${String(index + 1).padStart(4, "0")}`;
  return {
    lead_id: leadId,
    source_run_id: asString(raw.source_run_id) ?? runId,
    company_name: companyName,
    website,
    domain,
    country,
    city: asString(raw.city) ?? "未确认",
    buyer_type: asString(raw.buyer_type) ?? "potential mobile-accessory buyer",
    matched_products: asStringArray(raw.matched_products),
    contact_candidates: contacts,
    source_urls: sourceUrls,
    discovery_evidence: discoveryEvidence,
    dedupe_key: asString(raw.dedupe_key) ?? domain,
    duplicate_status:
      raw.duplicate_status === "possible_duplicate" || raw.duplicate_status === "duplicate"
        ? raw.duplicate_status
        : "new",
    created_at: asString(raw.created_at) ?? new Date().toISOString(),
    source_label: asString(raw.source_label) ?? "员工执行",
    discovery_confidence: confidence,
    dedupe_explanation:
      asString(raw.dedupe_explanation) ??
      `由 cbe-lead-discovery 员工按公开来源提取，当前 dedupe key 为 ${asString(raw.dedupe_key) ?? domain}。`,
  };
}

function normalizeLeadCandidates(value: unknown, runId: string, fallbackQuery: string): LeadCandidate[] {
  return Array.isArray(value)
    ? value
        .map((item, index) => normalizeLeadCandidate(item, index, runId, fallbackQuery))
        .filter((item): item is LeadCandidate => Boolean(item))
    : [];
}

// Best-effort parse of an LLM-emitted JSON array. Plain JSON.parse first; on failure (the lead
// employee occasionally emits an unescaped quote inside a Chinese evidence string, etc.), salvage the
// balanced top-level {...} objects and parse each independently so one malformed lead doesn't blank
// the whole list (previously a bare JSON.parse threw and lost every lead). Also unwraps { leads | targets }.
function parseJsonArrayTolerant(raw: string): unknown[] {
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      for (const k of ["leads", "targets", "summaries"]) if (Array.isArray(obj[k])) return obj[k] as unknown[];
    }
    return [];
  } catch {
    const items: unknown[] = [];
    let depth = 0, startIdx = -1, inStr = false, esc = false;
    for (let i = 0; i < text.length; i += 1) {
      const c = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === "\"") inStr = false;
        continue;
      }
      if (c === "\"") inStr = true;
      else if (c === "{") { if (depth === 0) startIdx = i; depth += 1; }
      else if (c === "}") {
        if (depth > 0) { depth -= 1; if (depth === 0 && startIdx >= 0) { try { items.push(JSON.parse(text.slice(startIdx, i + 1))); } catch { /* drop malformed element */ } startIdx = -1; } }
      }
    }
    return items;
  }
}

function extractLeadsFromEmployeeText(text: string, runId: string, fallbackQuery: string): LeadCandidate[] {
  const start = text.indexOf(LEADS_JSON_START);
  const end = text.indexOf(LEADS_JSON_END);
  if (start === -1 || end === -1 || end <= start) return [];
  const raw = text.slice(start + LEADS_JSON_START.length, end).trim();
  if (!raw) return [];
  const leads = parseJsonArrayTolerant(raw);
  return normalizeLeadCandidates(leads, runId, fallbackQuery);
}

function readStoredLeadDiscoveryState(): LeadDiscoveryStoredState | undefined {
  try {
    const raw = window.localStorage.getItem(LEAD_DISCOVERY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LeadDiscoveryStoredState) : undefined;
  } catch {
    return undefined;
  }
}

function writeStoredLeadDiscoveryState(state: LeadDiscoveryStoredState) {
  try {
    window.localStorage.setItem(LEAD_DISCOVERY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Persistence is best-effort; the live workflow should keep working if storage is blocked.
  }
}

function leadToScreeningInput(lead: LeadCandidate) {
  const emailContact = lead.contact_candidates.find((candidate) => candidate.type === "email");
  return {
    lead_id: lead.lead_id,
    source_run_id: lead.source_run_id,
    company_name: lead.company_name,
    website: lead.website,
    domain: lead.domain,
    country: lead.country,
    city: lead.city,
    buyer_type: lead.buyer_type,
    matched_products: lead.matched_products,
    email: emailContact?.value,
    contact_candidates: lead.contact_candidates,
    source_urls: lead.source_urls,
    discovery_evidence: lead.discovery_evidence,
    dedupe_key: lead.dedupe_key,
    duplicate_status: lead.duplicate_status,
    discovery_confidence: lead.discovery_confidence,
    dedupe_explanation: lead.dedupe_explanation,
    created_at: lead.created_at,
  };
}

function buildScreeningBatchPayload(nextLeads: LeadCandidate[]) {
  return JSON.stringify({ leads: nextLeads.map(leadToScreeningInput) }, null, 2);
}

async function writeClipboardText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export default function CrossBorderLeadDiscoveryPage() {
  const chatRef = useRef<AgentChatHandle | null>(null);
  const { state: gatewayState } = useGateway();
  const { data: leadAgent, loading: leadAgentLoading } = useAgent(LEAD_AGENT_ID);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([
    "phone-case",
    "tempered-glass",
    "usb-c-charger",
  ]);
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([
    "repair-chain",
    "electronics-retailer",
    "accessory-retailer",
  ]);
  const [selectedCountryCodes, setSelectedCountryCodes] = useState<string[]>(["GB", "US"]);
  const [targetCount, setTargetCount] = useState(50);
  const [maxResultsPerQuery, setMaxResultsPerQuery] = useState(10);
  const [excludeDomains, setExcludeDomains] = useState(
    "amazon.com, alibaba.com, aliexpress.com, temu.com, ebay.com",
  );
  const [customKeyword, setCustomKeyword] = useState("");
  const [leads, setLeads] = useState<LeadCandidate[]>([]);
  const [expandedLeadId, setExpandedLeadId] = useState<string | undefined>();
  const [envStatus, setEnvStatus] = useState<LeadRunEnvStatus | undefined>();
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "ready" | "error">("idle");
  const [runMessage, setRunMessage] = useState("等待获客员工执行配置");
  const [copiedLeadId, setCopiedLeadId] = useState<string | undefined>();
  const [copyMessage, setCopyMessage] = useState("");
  const [leadSessionKey, setLeadSessionKey] = useState<string | undefined>();
  const [hasHydratedState, setHasHydratedState] = useState(false);

  const selectedProducts = useMemo(
    () => productOptions.filter((product) => selectedProductIds.includes(product.id)),
    [selectedProductIds],
  );
  const selectedPersonas = useMemo(
    () => personaOptions.filter((persona) => selectedPersonaIds.includes(persona.id)),
    [selectedPersonaIds],
  );
  const selectedCountries = useMemo(
    () => countryOptions.filter((country) => selectedCountryCodes.includes(country.code)),
    [selectedCountryCodes],
  );
  const runInputs = useMemo(() => {
    const extraKeyword = customKeyword.trim();
    return {
      run_id: buildRunId(),
      product_keywords: [
        ...selectedProducts.map((product) => product.keyword),
        ...(extraKeyword ? [extraKeyword] : []),
      ],
      buyer_personas: selectedPersonas.map((persona) => persona.keyword),
      countries: selectedCountries.map((country) => country.code),
      languages: Array.from(new Set(selectedCountries.map((country) => country.language))),
      max_results_per_query: maxResultsPerQuery,
      daily_candidate_target: targetCount,
      exclude_domains: excludeDomains.split(",").map((item) => item.trim()).filter(Boolean),
    };
  }, [
    customKeyword,
    excludeDomains,
    maxResultsPerQuery,
    selectedCountries,
    selectedPersonas,
    selectedProducts,
    targetCount,
  ]);

  useEffect(() => {
    const stored = readStoredLeadDiscoveryState();
    if (stored) {
      setSelectedProductIds(stored.selectedProductIds);
      setSelectedPersonaIds(stored.selectedPersonaIds);
      setSelectedCountryCodes(stored.selectedCountryCodes);
      setTargetCount(stored.targetCount);
      setMaxResultsPerQuery(stored.maxResultsPerQuery);
      setExcludeDomains(stored.excludeDomains);
      setCustomKeyword(stored.customKeyword);
      setLeads(stored.leads);
      setExpandedLeadId(stored.expandedLeadId);
      setEnvStatus(stored.envStatus);
      setRunStatus(stored.runStatus === "running" ? "idle" : stored.runStatus);
      setRunMessage(stored.runStatus === "running" ? "上次运行未完成，请重新发起搜索" : stored.runMessage);
      setLeadSessionKey(stored.leadSessionKey);
    }
    setHasHydratedState(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedState) return;
    writeStoredLeadDiscoveryState({
      selectedProductIds,
      selectedPersonaIds,
      selectedCountryCodes,
      targetCount,
      maxResultsPerQuery,
      excludeDomains,
      customKeyword,
      leads,
      expandedLeadId,
      envStatus,
      runStatus,
      runMessage,
      leadSessionKey,
    });
  }, [
    customKeyword,
    envStatus,
    excludeDomains,
    expandedLeadId,
    hasHydratedState,
    leads,
    leadSessionKey,
    maxResultsPerQuery,
    runMessage,
    runStatus,
    selectedCountryCodes,
    selectedPersonaIds,
    selectedProductIds,
    targetCount,
  ]);

  const resetRun = useCallback(() => {
    setRunStatus("idle");
    setRunMessage("等待获客员工执行配置");
    setLeads([]);
    setExpandedLeadId(undefined);
    setEnvStatus(undefined);
    setCopiedLeadId(undefined);
    setCopyMessage("");
  }, []);

  const buildEmployeePrompt = useCallback(() => {
    return `${LEAD_TASK_PREFIX}
你是 OpenClaw 员工 \`${LEAD_AGENT_ID}\`。请你真实执行跨境营销获客，不要使用 Dashboard route、mock 数据或固定候选名单。

执行要求：
1. 按你的 skills 生成查询计划，调用 OpenClaw web_search 做公开网页搜索；只在需要确认候选公司官网内容时调用 web_fetch。
2. 只保留具体下游买家公司官网候选：维修连锁、电子零售商、配件零售商、手机门店、转售/进口采购商。
3. 必须剔除社媒主页、目录、市场平台、供应商目录、generic top supplier list、制造商、OEM/ODM、出口商和中国供应侧页面。
4. 每个候选都必须有 company_name、website、domain、country、buyer_type、matched_products、source_urls、discovery_evidence、dedupe_key、duplicate_status。
5. 不允许自动外联，不允许登录抓取，不允许泄露 API key，不允许编造公司/邮箱/URL。
6. 如果数量不足，简短说明 shortage，不要用低质量页面凑数。

获客输入 JSON：
${JSON.stringify(runInputs, null, 2)}

输出要求：
- 先给简短中文结论。
- 然后必须输出可被 Dashboard 解析的 JSON，放在以下两个标记之间，不要用 Markdown 代码块。
- 标记之间必须是严格合法的 JSON：字符串里的双引号必须转义（中文描述里尤其注意），不要加注释或尾随逗号，每个候选都是独立合法对象。duplicate_status 只能是 new / possible_duplicate / duplicate 之一。
${LEADS_JSON_START}
{
  "run_id": "${runInputs.run_id}",
  "leads": [
    {
      "lead_id": "lead_...",
      "source_run_id": "${runInputs.run_id}",
      "company_name": "...",
      "website": "https://...",
      "domain": "...",
      "country": "US|GB|DE|FR|BR|MX",
      "city": "未确认",
      "buyer_type": "repair chain|electronics retailer|accessory retailer|cell phone store|reseller|importer buyer",
      "matched_products": ["phone case"],
      "contact_candidates": [],
      "source_urls": ["https://..."],
      "discovery_evidence": [
        {
          "signal": "website_mentions_mobile_accessory_business",
          "source_url": "https://...",
          "excerpt": "...",
          "confidence": 0.7,
          "query": "...",
          "fetched_at": "ISO timestamp",
          "source_type": "public_web"
        }
      ],
      "dedupe_key": "...",
      "duplicate_status": "new|possible_duplicate|duplicate",
      "created_at": "ISO timestamp",
      "source_label": "员工执行",
      "discovery_confidence": 0.7,
      "dedupe_explanation": "..."
    }
  ],
  "shortage": null
}
${LEADS_JSON_END}`;
  }, [runInputs]);

  const startRun = useCallback(async () => {
    if (selectedProducts.length === 0 || selectedCountries.length === 0) {
      setRunStatus("error");
      setRunMessage("请至少选择一个产品关键词和一个国家");
      return;
    }
    if (gatewayState !== "connected") {
      setRunStatus("error");
      setRunMessage("OpenClaw Gateway 未连接，无法让获客员工执行任务。");
      return;
    }
    if (leadAgentLoading) {
      setRunStatus("error");
      setRunMessage("正在确认获客员工是否已注册，请稍后重试。");
      return;
    }
    if (!leadAgent) {
      setRunStatus("error");
      setRunMessage("未在 OpenClaw 注册 cbe-lead-discovery。请先运行 scripts/sentura-setup.sh 后刷新页面。");
      return;
    }
    if (!chatRef.current) {
      setRunStatus("error");
      setRunMessage("获客员工对话尚未初始化，请稍后重试。");
      return;
    }

    setRunStatus("running");
    setRunMessage("已提交给 cbe-lead-discovery 员工，等待 web_search/web_fetch 工具结果。");
    setExpandedLeadId(undefined);
    setLeads([]);

    try {
      await chatRef.current.sendMessage(buildEmployeePrompt());
    } catch (error) {
      setRunStatus("error");
      setRunMessage(error instanceof Error ? error.message : "获客员工任务提交失败");
    }
  }, [
    buildEmployeePrompt,
    gatewayState,
    leadAgent,
    leadAgentLoading,
    selectedCountries,
    selectedProducts,
  ]);

  const handleEmployeeMessage = useCallback((message: ChatMessage) => {
    if (message.role !== "assistant") return;
    if (runStatus !== "running") return;
    try {
      const nextLeads = extractLeadsFromEmployeeText(
        message.text,
        runInputs.run_id,
        runInputs.product_keywords[0] ?? "mobile accessories buyer",
      );
      if (nextLeads.length === 0) {
        setRunStatus("error");
        setRunMessage("获客员工已回复，但没有返回可解析的 LeadCandidate JSON。请查看右侧对话并要求员工按指定标记补交 JSON。");
        return;
      }
      setLeads(nextLeads);
      setRunStatus("ready");
      setRunMessage(`获客员工已完成 ${nextLeads.length} 条去重候选买家，来源为员工 web_search/web_fetch 调查。`);
    } catch (error) {
      setRunStatus("error");
      setRunMessage(error instanceof Error ? error.message : "无法解析获客员工返回的 LeadCandidate JSON");
    }
  }, [runInputs.product_keywords, runInputs.run_id, runStatus]);

  const handleEmployeeToolCall = useCallback((event: ToolCallEvent) => {
    if (event.phase === "start") {
      setRunMessage(`获客员工正在调用工具：${event.toolName}`);
    } else if (event.phase === "error") {
      setRunMessage(`获客员工工具失败：${event.toolName}`);
    } else if (event.phase === "result") {
      setRunMessage(`获客员工已收到工具结果：${event.toolName}`);
    }
  }, []);

  const copyLeadsForScreening = useCallback(async (nextLeads: LeadCandidate[], marker: string) => {
    if (nextLeads.length === 0) {
      setCopyMessage("没有可复制的候选买家");
      return;
    }
    try {
      await writeClipboardText(buildScreeningBatchPayload(nextLeads));
      setCopiedLeadId(marker);
      setCopyMessage(marker === "all" ? `已复制 ${nextLeads.length} 个买家到背调输入格式` : "已复制该买家到背调输入格式");
      window.setTimeout(() => {
        setCopiedLeadId(undefined);
        setCopyMessage("");
      }, 2500);
    } catch (error) {
      setCopyMessage(error instanceof Error ? `复制失败：${error.message}` : "复制失败");
    }
  }, []);

  const liveSources = [
    {
      label: "Tavily 搜索",
      note: envStatus
        ? envStatus.tavily_search?.configured
          ? "已配置，员工 web_search 可调用"
          : "缺少 TAVILY_API_KEY"
        : "由获客员工执行时检测",
      icon: envStatus?.tavily_search?.configured ? CheckCircle2 : Lock,
    },
    {
      label: "Companies House",
      note: envStatus
        ? envStatus.companies_house?.configured
          ? "已配置，背调 MCP 可用"
          : "未配置"
        : "由背调员工执行时检测",
      icon: envStatus?.companies_house?.configured ? CheckCircle2 : Lock,
    },
    {
      label: "Abstract / Hunter",
      note: envStatus
        ? envStatus.abstract_email_validation?.configured || envStatus.hunter_enrichment?.configured
          ? "已配置，邮箱 enrichment 可用"
          : "未配置"
        : "由背调员工执行时检测",
      icon:
        envStatus?.abstract_email_validation?.configured || envStatus?.hunter_enrichment?.configured
          ? CheckCircle2
          : Lock,
    },
    {
      label: "ImportYeti / 贸易数据",
      note: envStatus
        ? envStatus.importyeti_trade_data?.enabled
          ? `已启用，预算 $${envStatus.paid_trade_data?.max_paid_spend_usd ?? 0}`
          : envStatus.importyeti_trade_data?.configured
            ? "key 已配置，等待预算开关"
            : "未配置"
        : "由背调员工执行时检测",
      icon: envStatus?.importyeti_trade_data?.enabled ? CheckCircle2 : Lock,
    },
    {
      label: "SEC EDGAR",
      note: envStatus
        ? envStatus.sec_edgar?.user_agent_configured
          ? "无需 API key，User-Agent 已配置"
          : "无需 API key，使用默认 User-Agent"
        : "无需 API key，员工按需调用",
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="min-h-full bg-muted/20 p-4 md:p-6">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Globe2 className="h-3.5 w-3.5" />
            <span>跨境电商 / 手机配件 / Phase 1</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">营销获客工作台</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Database className="h-3 w-3" />
            表格: 员工执行
          </Badge>
          <Badge variant={gatewayState === "connected" ? "outline" : "destructive"} className="gap-1">
            <Globe2 className="h-3 w-3" />
            Gateway {gatewayState === "connected" ? "已连接" : "未连接"}
          </Badge>
          <Badge variant={leadAgent ? "outline" : "destructive"} className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            {leadAgent ? "员工已注册" : leadAgentLoading ? "检查员工" : "员工未注册"}
          </Badge>
          <Button variant="outline" size="sm" onClick={resetRun}>
            <RefreshCw className="h-3.5 w-3.5" />
            重置运行
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[280px_minmax(0,1fr)_380px]">
        <aside className="rounded-md border bg-background p-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">运行配置</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">关键词、买家画像、国家与排除域名</p>
            </div>
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="space-y-4">
            <section>
              <div className="mb-2 text-xs font-medium text-muted-foreground">产品关键词</div>
              <div className="flex flex-wrap gap-1.5">
                {productOptions.map((product) => {
                  const active = selectedProductIds.includes(product.id);
                  return (
                    <Button
                      key={product.id}
                      type="button"
                      variant={active ? "default" : "outline"}
                      size="sm"
                      aria-pressed={active}
                      onClick={() => setSelectedProductIds((values) => toggleValue(values, product.id))}
                    >
                      {product.label}
                    </Button>
                  );
                })}
              </div>
              <Input
                className="mt-2"
                value={customKeyword}
                onChange={(event) => setCustomKeyword(event.target.value)}
                placeholder="自定义英文关键词"
              />
            </section>

            <section>
              <div className="mb-2 text-xs font-medium text-muted-foreground">买家画像</div>
              <div className="grid grid-cols-2 gap-1.5">
                {personaOptions.map((persona) => {
                  const active = selectedPersonaIds.includes(persona.id);
                  return (
                    <Button
                      key={persona.id}
                      type="button"
                      variant={active ? "secondary" : "outline"}
                      size="sm"
                      aria-pressed={active}
                      onClick={() => setSelectedPersonaIds((values) => toggleValue(values, persona.id))}
                      className="justify-start"
                    >
                      {persona.label}
                    </Button>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="mb-2 text-xs font-medium text-muted-foreground">国家 / 语言</div>
              <div className="grid grid-cols-3 gap-1.5">
                {countryOptions.map((country) => {
                  const active = selectedCountryCodes.includes(country.code);
                  return (
                    <Button
                      key={country.code}
                      type="button"
                      variant={active ? "default" : "outline"}
                      size="sm"
                      aria-pressed={active}
                      onClick={() => setSelectedCountryCodes((values) => toggleValue(values, country.code))}
                      className="px-1.5"
                    >
                      {country.label}
                    </Button>
                  );
                })}
              </div>
            </section>

            <section className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                目标数量
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={targetCount}
                  onChange={(event) => setTargetCount(Number(event.target.value) || 1)}
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                单查询上限
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={maxResultsPerQuery}
                  onChange={(event) => setMaxResultsPerQuery(Number(event.target.value) || 1)}
                />
              </label>
            </section>

            <section>
              <div className="mb-2 text-xs font-medium text-muted-foreground">排除域名</div>
              <textarea
                className="min-h-20 w-full rounded-md border bg-background px-2 py-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={excludeDomains}
                onChange={(event) => setExcludeDomains(event.target.value)}
              />
            </section>

            <section>
              <div className="mb-2 text-xs font-medium text-muted-foreground">实时来源状态</div>
              <div className="space-y-1.5">
                {liveSources.map((source) => (
                  <div key={source.label} className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
                    <source.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{source.label}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{source.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <Button className="w-full" onClick={startRun} disabled={runStatus === "running" || leadAgentLoading}>
              {runStatus === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              让获客员工开始搜索
            </Button>
          </div>
        </aside>

        <main className="min-w-0 space-y-4">
          <div className="rounded-md border bg-background">
            <div className="flex flex-col gap-2 border-b px-3 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-semibold">候选买家表</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {runMessage}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {copyMessage ? <span className="text-xs text-muted-foreground">{copyMessage}</span> : null}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyLeadsForScreening(leads, "all")}
                  disabled={leads.length === 0}
                >
                  {copiedLeadId === "all" ? <ClipboardCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  一键复制到背调
                </Button>
                <Badge variant={runStatus === "error" ? "destructive" : "outline"} className="gap-1">
                  {runStatus === "ready" ? <CheckCircle2 className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                  {runStatus === "ready" ? "可复核" : runStatus === "running" ? "运行中" : runStatus === "error" ? "需调整" : "未运行"}
                </Badge>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">公司</th>
                    <th className="px-3 py-2 text-left">国家</th>
                    <th className="px-3 py-2 text-left">类型</th>
                    <th className="px-3 py-2 text-left">匹配产品</th>
                    <th className="px-3 py-2 text-left">域名 / 联系</th>
                    <th className="px-3 py-2 text-left">来源</th>
                    <th className="px-3 py-2 text-left">置信度</th>
                    <th className="px-3 py-2 text-left">去重</th>
                    <th className="px-3 py-2 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="border-t px-3 py-8 text-center text-sm text-muted-foreground">
                        点击“让获客员工开始搜索”后，cbe-lead-discovery 会调用 OpenClaw 搜索/抓取工具，只把具体公司官网候选写入此表。
                      </td>
                    </tr>
                  ) : leads.map((lead) => {
                    const expanded = expandedLeadId === lead.lead_id;
                    return (
                      <Fragment key={lead.lead_id}>
                        <tr className={cn("border-t", expanded && "bg-primary/5")}>
                          <td className="px-3 py-2">
                            <div className="font-medium">{lead.company_name}</div>
                            <div className="text-xs text-muted-foreground">{lead.city}</div>
                          </td>
                          <td className="px-3 py-2">{lead.country}</td>
                          <td className="px-3 py-2">{lead.buyer_type}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {lead.matched_products.slice(0, 2).map((product) => (
                                <Badge key={product} variant="secondary">{product}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="max-w-64 truncate font-mono text-xs">{lead.domain}</div>
                            <div className="max-w-64 truncate text-xs text-muted-foreground">
                              {lead.contact_candidates[0]?.value ?? "无公开联系人"}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="gap-1">
                              <Database className="h-3 w-3" />
                              {lead.source_label}
                            </Badge>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {lead.source_urls.length} 个来源
                            </div>
                          </td>
                          <td className="px-3 py-2">{percent(lead.discovery_confidence)}</td>
                          <td className="px-3 py-2">
                            <Badge variant={lead.duplicate_status === "new" ? "secondary" : "outline"}>
                              {lead.duplicate_status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-expanded={expanded}
                                aria-label={`${expanded ? "收起" : "查看"} ${lead.company_name} 来源与去重`}
                                onClick={() => setExpandedLeadId((current) => (current === lead.lead_id ? undefined : lead.lead_id))}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`复制 ${lead.company_name} 到背调输入格式`}
                                onClick={() => copyLeadsForScreening([lead], lead.lead_id)}
                              >
                                {copiedLeadId === lead.lead_id ? <ClipboardCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {expanded ? (
                          <tr className="border-t bg-muted/20">
                            <td colSpan={9} className="px-3 py-3">
                              <div className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
                                <div className="rounded-md border bg-background p-3">
                                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                                    来源与去重
                                  </div>
                                  <div className="text-sm font-medium">{lead.company_name}</div>
                                  <div className="mt-1 text-xs text-muted-foreground">{lead.dedupe_explanation}</div>
                                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                    <div className="rounded-md bg-muted/40 p-2">
                                      <div className="text-muted-foreground">dedupe_key</div>
                                      <div className="mt-1 truncate font-mono">{lead.dedupe_key}</div>
                                    </div>
                                    <div className="rounded-md bg-muted/40 p-2">
                                      <div className="text-muted-foreground">created_at</div>
                                      <div className="mt-1 truncate">{lead.created_at}</div>
                                    </div>
                                  </div>
                                </div>
                                <div className="grid gap-2 xl:grid-cols-2">
                                  {lead.discovery_evidence.map((evidence) => (
                                    <div key={`${lead.lead_id}-${evidence.signal}`} className="rounded-md border bg-background p-3">
                                      <div className="flex items-center justify-between gap-2">
                                        <Badge variant="secondary">{sourceTypeLabels[evidence.source_type]}</Badge>
                                        <span className="text-[11px] text-muted-foreground">{evidence.fetched_at}</span>
                                      </div>
                                      <p className="mt-2 text-xs leading-relaxed">{evidence.excerpt}</p>
                                      <div className="mt-2 flex items-start gap-1 text-[11px] text-muted-foreground">
                                        <Link2 className="mt-0.5 h-3 w-3 shrink-0" />
                                        <span className="break-all">{evidence.source_url}</span>
                                      </div>
                                      <div className="mt-1 text-[11px] text-muted-foreground">query: {evidence.query}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        <aside className="rounded-md border bg-background">
          <div className="border-b px-3 py-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">获客员工执行</h2>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              正式获客由这个 OpenClaw 员工会话执行，Dashboard 只解析员工返回的结构化 JSON。
            </p>
          </div>
          <AgentChat
            ref={chatRef}
            agentId={LEAD_AGENT_ID}
            sessionKey={leadSessionKey}
            sessionLabel="CBE Lead Discovery"
            onSessionCreated={setLeadSessionKey}
            onMessage={handleEmployeeMessage}
            onToolCall={handleEmployeeToolCall}
            hiddenUserPrefixes={[LEAD_TASK_PREFIX]}
            className="h-[620px] border-0"
          />
        </aside>
      </div>
    </div>
  );
}
