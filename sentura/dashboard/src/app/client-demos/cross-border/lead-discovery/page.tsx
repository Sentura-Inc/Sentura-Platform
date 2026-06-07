"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
  source_label: "实时查询";
  discovery_confidence: number;
  dedupe_explanation: string;
}

interface EnvProviderStatus {
  configured?: boolean;
  enabled?: boolean;
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

interface LeadRunResponse {
  mode?: "live";
  provider?: string;
  searched_at?: string;
  env_status?: LeadRunEnvStatus;
  run_id?: string;
  query_log?: unknown[];
  leads?: LeadCandidate[];
  errors?: string[];
  shortage?: string | null;
  error?: string;
}

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

export default function CrossBorderLeadDiscoveryPage() {
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
  const [runMessage, setRunMessage] = useState("等待实时搜索配置");

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

  const resetRun = useCallback(() => {
    setRunStatus("idle");
    setRunMessage("等待实时搜索配置");
    setLeads([]);
    setExpandedLeadId(undefined);
    setEnvStatus(undefined);
  }, []);

  const startRun = useCallback(async () => {
    if (selectedProducts.length === 0 || selectedCountries.length === 0) {
      setRunStatus("error");
      setRunMessage("请至少选择一个产品关键词和一个国家");
      return;
    }

    setRunStatus("running");
    setRunMessage("已生成查询计划，正在调用 Tavily 实时搜索 API");
    setExpandedLeadId(undefined);

    try {
      const response = await fetch("/api/client-demos/cross-border/lead-discovery/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(runInputs),
      });
      const payload = (await response.json()) as LeadRunResponse;
      setEnvStatus(payload.env_status);
      if (!response.ok) {
        throw new Error(payload.error ?? "实时搜索 API 调用失败");
      }

      const nextLeads = Array.isArray(payload.leads) ? payload.leads : [];
      setLeads(nextLeads);
      setRunStatus("ready");
      const apiMessage =
        payload.shortage ??
        `实时查询返回 ${nextLeads.length} 条去重候选，来源为 Tavily 公开网页搜索。`;
      setRunMessage(apiMessage);
    } catch (error) {
      setRunStatus("error");
      setRunMessage(error instanceof Error ? error.message : "发送运行请求失败");
    }
  }, [runInputs, selectedCountries, selectedProducts, targetCount]);

  const liveSources = [
    {
      label: "Tavily 搜索",
      note: envStatus
        ? envStatus.tavily_search?.configured
          ? "已配置，当前页面实时调用"
          : "缺少 TAVILY_API_KEY"
        : "运行后检测",
      icon: envStatus?.tavily_search?.configured ? CheckCircle2 : Lock,
    },
    {
      label: "Companies House",
      note: envStatus
        ? envStatus.companies_house?.configured
          ? "已配置，背调 MCP 可用"
          : "未配置"
        : "运行后检测",
      icon: envStatus?.companies_house?.configured ? CheckCircle2 : Lock,
    },
    {
      label: "Abstract / Hunter",
      note: envStatus
        ? envStatus.abstract_email_validation?.configured || envStatus.hunter_enrichment?.configured
          ? "已配置，邮箱 enrichment 可用"
          : "未配置"
        : "运行后检测",
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
        : "运行后检测",
      icon: envStatus?.importyeti_trade_data?.enabled ? CheckCircle2 : Lock,
    },
    {
      label: "SEC EDGAR",
      note: envStatus
        ? envStatus.sec_edgar?.configured
          ? "User-Agent 已配置"
          : "未配置 User-Agent"
        : "运行后检测",
      icon: envStatus?.sec_edgar?.configured ? CheckCircle2 : Lock,
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
            表格: 实时查询
          </Badge>
          <Button variant="outline" size="sm" onClick={resetRun}>
            <RefreshCw className="h-3.5 w-3.5" />
            重置运行
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
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

            <Button className="w-full" onClick={startRun} disabled={runStatus === "running"}>
              {runStatus === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              开始获客搜索
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
                    <th className="px-3 py-2 text-left">查看</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="border-t px-3 py-8 text-center text-sm text-muted-foreground">
                        点击“开始获客搜索”后，系统会调用 Tavily 实时搜索，只把具体公司官网候选写入此表。
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
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-expanded={expanded}
                              aria-label={`${expanded ? "收起" : "查看"} ${lead.company_name} 来源与去重`}
                              onClick={() => setExpandedLeadId((current) => (current === lead.lead_id ? undefined : lead.lead_id))}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
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
      </div>
    </div>
  );
}
