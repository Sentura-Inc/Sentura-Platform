"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Database,
  Download,
  FileJson,
  Loader2,
  MessageSquareText,
  PackageCheck,
  Play,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { AgentChat, type AgentChatHandle, type ChatMessage } from "@/components/agent-chat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAgent, useGateway } from "@/lib/gateway";
import { cn } from "@/lib/utils";

const ACCIO_AGENT_ID = "cbe-accio-memory";
const ACCIO_TASK_PREFIX = "[CBE Accio Memory Employee Task]";
const SUMMARY_JSON_START = "ACCIO_SUMMARIES_JSON_START";
const SUMMARY_JSON_END = "ACCIO_SUMMARIES_JSON_END";
const ACCIO_STORAGE_KEY = "sentura:cbe:accio-memory:v2";

type Sender = "buyer" | "seller" | "system";

interface AccioMessage {
  timestamp: string;
  sender: Sender;
  text: string;
}

interface AccioAttachment {
  file_name: string;
  type: string;
  description?: string;
}

interface AccioBuyer {
  display_name: string;
  company_name: string;
  country: string;
  city?: string;
  email?: string;
  website?: string;
  claimed_role?: string;
}

interface AccioConversation {
  conversation_id: string;
  buyer: AccioBuyer;
  messages: AccioMessage[];
  attachments: AccioAttachment[];
}

interface AccioChatExport {
  export_metadata: {
    platform: string;
    exported_at: string;
    seller_company: string;
    source_file: string;
    data_classification: string;
  };
  conversations: AccioConversation[];
}

interface PurchaseIntent {
  product: string;
  models: string[];
  quantity?: number;
  monthly_potential_quantity?: number;
  packaging?: string;
  target_price_usd?: number;
  seller_best_price_usd?: number;
  packaging_addon_usd?: number;
  incoterm?: string;
  payment_terms?: string;
  logistics_terms?: string;
  certification_terms?: string;
}

interface NegotiatedPrice {
  product: string;
  quoted_price_usd?: number;
  target_price_usd?: number;
  agreed_or_best_price_usd?: number;
  currency: "USD";
  notes: string;
}

interface MemoryWritePreview {
  status: "preview_only";
  memory_fact_id: string;
  source_type: "demo_fixture" | "self_reported";
  facts: string[];
  source_file: string;
  conversation_id: string;
}

interface AccioSummary {
  conversation_id: string;
  customer_profile: {
    company_name: string;
    country: string;
    city?: string;
    contact_person: string;
    role?: string;
    email?: string;
    website?: string;
    company_evidence_status: "unverified_chat_claims" | "insufficient_evidence";
  };
  purchase_intent: PurchaseIntent[];
  negotiated_prices: NegotiatedPrice[];
  negotiation_summary: string;
  next_actions: string[];
  behavior_signals: {
    inquiry_professionalism_points: number;
    responsiveness_points: number;
    notes: string;
  };
  source_references: Array<{
    source_type: "demo_fixture" | "self_reported";
    source_file: string;
    conversation_id: string;
  }>;
  memory_write_preview: MemoryWritePreview;
}

interface StoredState {
  chatExport?: AccioChatExport;
  summaries: AccioSummary[];
  selectedConversationId?: string;
  sourceLabel: string;
  runStatus: "idle" | "loading" | "loaded" | "ready" | "error";
  runMessage: string;
  accioSessionKey?: string;
}

const senderLabels: Record<Sender, string> = {
  buyer: "买家",
  seller: "卖家",
  system: "系统",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function maskEmail(email?: string) {
  if (!email || !email.includes("@")) return email ?? "未提供";
  const [name, domain] = email.split("@");
  const safeName = name.length <= 2 ? `${name[0] ?? "*"}*` : `${name.slice(0, 2)}***`;
  return `${safeName}@${domain}`;
}

function price(value?: number) {
  return typeof value === "number" ? `USD ${value.toFixed(value < 1 ? 3 : 2)}` : "未提及";
}

function quantity(value?: number) {
  return typeof value === "number" ? `${value.toLocaleString("en-US")} pcs` : "未提及";
}

function validateExport(raw: unknown): AccioChatExport {
  const record = asRecord(raw);
  const metadata = asRecord(record.export_metadata);
  const conversations = Array.isArray(record.conversations) ? record.conversations : [];
  if (!asString(metadata.platform) || !asString(metadata.exported_at) || !asString(metadata.source_file)) {
    throw new Error("Accio JSON 缺少 export_metadata.platform/exported_at/source_file。");
  }
  if (!conversations.length) {
    throw new Error("Accio JSON 缺少 conversations[]。");
  }
  return {
    export_metadata: {
      platform: metadata.platform as string,
      exported_at: metadata.exported_at as string,
      seller_company: asString(metadata.seller_company) ?? "Unknown seller",
      source_file: metadata.source_file as string,
      data_classification: asString(metadata.data_classification) ?? "T3-business-conversation",
    },
    conversations: conversations.map((item, index) => {
      const conversation = asRecord(item);
      const buyer = asRecord(conversation.buyer);
      const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
      if (!asString(conversation.conversation_id) || !asString(buyer.company_name) || !messages.length) {
        throw new Error(`第 ${index + 1} 条 conversation 缺少 conversation_id、buyer.company_name 或 messages。`);
      }
      return {
        conversation_id: conversation.conversation_id as string,
        buyer: {
          display_name: asString(buyer.display_name) ?? "Unknown contact",
          company_name: buyer.company_name as string,
          country: asString(buyer.country) ?? "ZZ",
          city: asString(buyer.city),
          email: asString(buyer.email),
          website: asString(buyer.website),
          claimed_role: asString(buyer.claimed_role),
        },
        messages: messages.map((message, messageIndex) => {
          const msg = asRecord(message);
          if (!asString(msg.timestamp) || !asString(msg.sender) || !asString(msg.text)) {
            throw new Error(`${conversation.conversation_id} 第 ${messageIndex + 1} 条消息字段不完整。`);
          }
          return {
            timestamp: msg.timestamp as string,
            sender: ["buyer", "seller", "system"].includes(msg.sender as string)
              ? (msg.sender as Sender)
              : "system",
            text: msg.text as string,
          };
        }),
        attachments: Array.isArray(conversation.attachments)
          ? conversation.attachments.map((attachment) => {
              const att = asRecord(attachment);
              return {
                file_name: asString(att.file_name) ?? "unnamed",
                type: asString(att.type) ?? "attachment",
                description: asString(att.description),
              };
            })
          : [],
      };
    }),
  };
}

function extractSummariesFromEmployeeText(text: string): AccioSummary[] | null {
  const start = text.indexOf(SUMMARY_JSON_START);
  const end = text.indexOf(SUMMARY_JSON_END);
  if (start === -1 || end === -1 || end <= start) return null;
  const jsonText = text.slice(start + SUMMARY_JSON_START.length, end).trim();
  try {
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) return null;
    return parsed.map(normalizeSummary);
  } catch {
    return null;
  }
}

function normalizeSummary(value: unknown): AccioSummary {
  const record = asRecord(value);
  const profile = asRecord(record.customer_profile);
  const purchase = Array.isArray(record.purchase_intent) ? record.purchase_intent : [];
  const priceRows = Array.isArray(record.negotiated_prices) ? record.negotiated_prices : [];
  const behavior = asRecord(record.behavior_signals);
  const sourceRefs = Array.isArray(record.source_references) ? record.source_references : [];
  const memoryPreview = asRecord(record.memory_write_preview);
  const conversationId = asString(record.conversation_id) ?? "unknown";
  const company = asString(profile.company_name) ?? "Unknown company";
  const country = asString(profile.country) ?? "ZZ";
  return {
    conversation_id: conversationId,
    customer_profile: {
      company_name: company,
      country,
      city: asString(profile.city),
      contact_person: asString(profile.contact_person) ?? "Unknown contact",
      role: asString(profile.role),
      email: asString(profile.email),
      website: asString(profile.website),
      company_evidence_status: "unverified_chat_claims",
    },
    purchase_intent: purchase.map((item) => {
      const intent = asRecord(item);
      return {
        product: asString(intent.product) ?? "mobile phone accessories",
        models: Array.isArray(intent.models) ? intent.models.filter((model): model is string => typeof model === "string") : [],
        quantity: asNumber(intent.quantity),
        monthly_potential_quantity: asNumber(intent.monthly_potential_quantity),
        packaging: asString(intent.packaging),
        target_price_usd: asNumber(intent.target_price_usd),
        seller_best_price_usd: asNumber(intent.seller_best_price_usd),
        packaging_addon_usd: asNumber(intent.packaging_addon_usd),
        incoterm: asString(intent.incoterm),
        payment_terms: asString(intent.payment_terms),
        logistics_terms: asString(intent.logistics_terms),
        certification_terms: asString(intent.certification_terms),
      };
    }),
    negotiated_prices: priceRows.map((item) => {
      const row = asRecord(item);
      return {
        product: asString(row.product) ?? "mobile phone accessories",
        quoted_price_usd: asNumber(row.quoted_price_usd),
        target_price_usd: asNumber(row.target_price_usd),
        agreed_or_best_price_usd: asNumber(row.agreed_or_best_price_usd),
        currency: "USD",
        notes: asString(row.notes) ?? "来自 Accio 结构化报告。",
      };
    }),
    negotiation_summary: asString(record.negotiation_summary) ?? "已生成 Accio 对话摘要。",
    next_actions: Array.isArray(record.next_actions)
      ? record.next_actions.filter((item): item is string => typeof item === "string")
      : ["人工复核客户画像、采购需求和下一步跟进。"],
    behavior_signals: {
      inquiry_professionalism_points: asNumber(behavior.inquiry_professionalism_points) ?? 6,
      responsiveness_points: asNumber(behavior.responsiveness_points) ?? 6,
      notes: asString(behavior.notes) ?? "行为信号来自 Accio 对话。",
    },
    source_references: sourceRefs.length
      ? sourceRefs.map((item) => {
          const ref = asRecord(item);
          return {
            source_type: "demo_fixture",
            source_file: asString(ref.source_file) ?? "accio-chat-records.sample.json",
            conversation_id: asString(ref.conversation_id) ?? conversationId,
          };
        })
      : [{ source_type: "demo_fixture", source_file: "accio-chat-records.sample.json", conversation_id: conversationId }],
    memory_write_preview: {
      status: "preview_only",
      memory_fact_id: asString(memoryPreview.memory_fact_id) ?? `accio-memory-${conversationId}`,
      source_type: "demo_fixture",
      facts: Array.isArray(memoryPreview.facts)
        ? memoryPreview.facts.filter((item): item is string => typeof item === "string")
        : [`${company} 的 Accio 结构化摘要预览。`],
      source_file: asString(memoryPreview.source_file) ?? "accio-chat-records.sample.json",
      conversation_id: asString(memoryPreview.conversation_id) ?? conversationId,
    },
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function addHighlightTerm(terms: Set<string>, value?: string) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length < 2) return;
  terms.add(trimmed);
  for (const part of trimmed.split(/\s*(?:,|;|\/|\band\b|\+)\s*/i)) {
    const compact = part.trim();
    if (compact.length >= 4) terms.add(compact);
  }
}

function addHighlightPrice(terms: Set<string>, value?: number) {
  if (typeof value !== "number") return;
  terms.add(price(value));
  terms.add(`USD ${value}`);
}

function addHighlightQuantity(terms: Set<string>, value?: number) {
  if (typeof value !== "number") return;
  terms.add(quantity(value));
}

function highlightText(text: string, summary?: AccioSummary) {
  if (!summary) return text;
  const terms = new Set<string>();
  for (const intent of summary.purchase_intent) {
    addHighlightTerm(terms, intent.product);
    addHighlightTerm(terms, intent.packaging);
    addHighlightTerm(terms, intent.incoterm);
    addHighlightTerm(terms, intent.payment_terms);
    addHighlightTerm(terms, intent.logistics_terms);
    addHighlightTerm(terms, intent.certification_terms);
    for (const model of intent.models) addHighlightTerm(terms, model);
    addHighlightQuantity(terms, intent.quantity);
    addHighlightQuantity(terms, intent.monthly_potential_quantity);
    addHighlightPrice(terms, intent.target_price_usd);
    addHighlightPrice(terms, intent.seller_best_price_usd);
    addHighlightPrice(terms, intent.packaging_addon_usd);
  }
  for (const row of summary.negotiated_prices) {
    addHighlightTerm(terms, row.product);
    addHighlightPrice(terms, row.quoted_price_usd);
    addHighlightPrice(terms, row.target_price_usd);
    addHighlightPrice(terms, row.agreed_or_best_price_usd);
  }

  const orderedTerms = Array.from(terms).sort((left, right) => right.length - left.length);
  if (orderedTerms.length === 0) return text;

  const pattern = new RegExp(`(${orderedTerms.map(escapeRegExp).join("|")})`, "gi");
  const exactTerms = new Set(orderedTerms.map((term) => term.toLowerCase()));
  return text.split(pattern).map((part, index) =>
    exactTerms.has(part.toLowerCase()) ? (
      <mark key={`${part}-${index}`} className="rounded bg-amber-100 px-1 text-amber-950">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function buildEmployeePrompt(chatExport: AccioChatExport) {
  return `${ACCIO_TASK_PREFIX}

请处理以下 Alibaba Accio JSON，严格按 \`跨境电商/DESIGN.md\` Milestone 6 输出报告。

要求：
- 只依据下方 JSON 的 buyer/messages/attachments 分析，不要使用示例模板、文件名或 Dashboard 预设内容补全事实。
- 先调用 Accio parser 工具验证 JSON，并总结 conversation_count。
- 再调用 Accio summarizer 工具，为每条 conversation 生成一个 AccioChatSummary；如工具遗漏了 messages 中明确出现的字段，请基于原文补齐。
- 提取公司信息、产品、型号、数量、月潜量、目标/报价/最佳价格、包装加价、付款/物流/证书条款、next_actions、behavior_signals。
- 只生成 memory_write_preview / memory_preview 兼容预览，不要声称已经写入长期记忆。
- 不要生成 screening_handoff_target、handoff、lead_id 或任何背调移交字段。
- 最后用以下标记包住 JSON 数组，供 Dashboard 解析：
${SUMMARY_JSON_START}
[...]
${SUMMARY_JSON_END}

Accio JSON:
${JSON.stringify(chatExport, null, 2)}`;
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export default function CrossBorderAccioMemoryPage() {
  const chatRef = useRef<AgentChatHandle | null>(null);
  const { state: gatewayState } = useGateway();
  const { data: accioAgent, loading: agentLoading, error: agentError } = useAgent(ACCIO_AGENT_ID);
  const [chatExport, setChatExport] = useState<AccioChatExport | undefined>();
  const [summaries, setSummaries] = useState<AccioSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [sourceLabel, setSourceLabel] = useState("未加载");
  const [runStatus, setRunStatus] = useState<StoredState["runStatus"]>("idle");
  const [runMessage, setRunMessage] = useState("加载演示 Accio 记录或上传 JSON 后，需由记忆员工分析后才展示报告。");
  const [accioSessionKey, setAccioSessionKey] = useState<string | undefined>();
  const [copyMessage, setCopyMessage] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACCIO_STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as StoredState;
      if (stored.chatExport) setChatExport(stored.chatExport);
      if (Array.isArray(stored.summaries)) setSummaries(stored.summaries.map(normalizeSummary));
      setSelectedConversationId(stored.selectedConversationId);
      setSourceLabel(stored.sourceLabel ?? "已恢复");
      setRunStatus(stored.runStatus === "loading" ? "idle" : stored.runStatus ?? "idle");
      setRunMessage(stored.runStatus === "loading" ? "上次运行中断，请重新运行员工确认。" : stored.runMessage ?? "");
      setAccioSessionKey(stored.accioSessionKey);
    } catch {
      localStorage.removeItem(ACCIO_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const stored: StoredState = {
      chatExport,
      summaries,
      selectedConversationId,
      sourceLabel,
      runStatus,
      runMessage,
      accioSessionKey,
    };
    localStorage.setItem(ACCIO_STORAGE_KEY, JSON.stringify(stored));
  }, [chatExport, summaries, selectedConversationId, sourceLabel, runStatus, runMessage, accioSessionKey]);

  const selectedConversation = useMemo(
    () => chatExport?.conversations.find((conversation) => conversation.conversation_id === selectedConversationId),
    [chatExport, selectedConversationId],
  );
  const selectedSummary = useMemo(
    () => summaries.find((summary) => summary.conversation_id === selectedConversationId),
    [summaries, selectedConversationId],
  );
  const conversationCount = chatExport?.conversations.length ?? 0;
  const canRunEmployee = gatewayState === "connected" && !!accioAgent;

  const acceptExport = useCallback((nextExport: AccioChatExport, nextSourceLabel: string) => {
    setChatExport(nextExport);
    setSummaries([]);
    setSelectedConversationId(nextExport.conversations[0]?.conversation_id);
    setSourceLabel(nextSourceLabel);
    setRunStatus("loaded");
    setRunMessage(`已加载并校验 ${nextExport.conversations.length} 条 Accio 对话；等待记忆员工分析后展示高亮和结构化报告。`);
    setAccioSessionKey(undefined);
    setCopyMessage("");
  }, []);

  const loadSample = useCallback(async () => {
    setRunStatus("loading");
    setRunMessage("正在读取跨境电商/fixtures/accio-chat-records.sample.json...");
    try {
      const response = await fetch("/api/client-demos/cross-border/accio-memory/sample");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "读取演示 Accio 记录失败。");
      acceptExport(validateExport(body.chat_export), body.source_label ?? "演示数据");
    } catch (error) {
      setRunStatus("error");
      setRunMessage(error instanceof Error ? error.message : "读取演示 Accio 记录失败。");
    }
  }, [acceptExport]);

  const handleUpload = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setRunStatus("loading");
      setRunMessage(`正在校验上传文件 ${file.name}...`);
      try {
        const raw = await file.text();
        const parsed = validateExport(JSON.parse(raw));
        parsed.export_metadata.source_file = parsed.export_metadata.source_file || file.name;
        acceptExport(parsed, "上传 JSON");
      } catch (error) {
        setRunStatus("error");
        setRunMessage(error instanceof Error ? error.message : "上传 JSON 解析失败。");
      }
    },
    [acceptExport],
  );

  const runEmployee = useCallback(async () => {
    if (!chatExport) {
      setRunStatus("error");
      setRunMessage("请先加载或上传 Accio JSON。");
      return;
    }
    if (!canRunEmployee) {
      setRunStatus("error");
      setRunMessage("OpenClaw Gateway 未连接或 cbe-accio-memory 尚未注册；需要真实记忆员工执行后才展示提取结果。");
      return;
    }
    setSummaries([]);
    setRunStatus("loading");
    setRunMessage("正在把 Accio JSON 发送给真实记忆员工处理...");
    await chatRef.current?.sendMessage(buildEmployeePrompt(chatExport));
  }, [canRunEmployee, chatExport]);

  const handleEmployeeMessage = useCallback((message: ChatMessage) => {
    if (message.role !== "assistant" || message.streaming) return;
    const parsed = extractSummariesFromEmployeeText(message.text);
    if (!parsed) return;
    setSummaries(parsed);
    setSelectedConversationId(parsed[0]?.conversation_id);
    setRunStatus("ready");
    setRunMessage(`记忆员工返回 ${parsed.length} 份 Accio 结构化报告。`);
  }, []);

  const previewMemory = useCallback(async () => {
    if (!selectedSummary) return;
    await copyText(JSON.stringify(selectedSummary.memory_write_preview, null, 2));
    setCopyMessage("分析报告预览已复制，仍未写入长期记忆。");
  }, [selectedSummary]);

  return (
    <div className="flex h-full min-h-screen flex-col bg-background text-foreground">
      <header className="border-b bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-normal">跨境 Accio 记忆处理</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              加载 Accio JSON，审阅原始对话，并等待记忆员工返回结构化交易报告和分析报告预览。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={sourceLabel === "演示数据" ? "secondary" : "outline"}>{sourceLabel}</Badge>
            <Badge variant={runStatus === "error" ? "destructive" : "outline"}>
              {runStatus === "loading"
                ? "处理中"
                : runStatus === "ready"
                  ? "已返回报告"
                  : runStatus === "loaded"
                    ? "待员工分析"
                    : runStatus === "error"
                      ? "有错误"
                      : "待加载"}
            </Badge>
          </div>
        </div>
      </header>

      <main className="grid flex-1 grid-cols-1 gap-4 p-4 xl:grid-cols-[300px_minmax(0,1fr)_390px]">
        <section className="space-y-4">
          <div className="rounded-md border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileJson className="h-4 w-4" />
              Accio 来源
            </div>
            <div className="mt-4 space-y-3">
              <Button className="w-full justify-start" onClick={loadSample} disabled={runStatus === "loading"}>
                {runStatus === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                加载演示 Accio 记录
              </Button>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50">
                <Upload className="h-4 w-4" />
                上传 Accio JSON
                <Input
                  className="hidden"
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => void handleUpload(event.target.files?.[0])}
                />
              </label>
              <div className="rounded-md bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
                <div className="flex items-center gap-2">
                  {runStatus === "error" ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  {runMessage}
                </div>
                {chatExport && (
                  <dl className="mt-3 space-y-1">
                    <div className="flex justify-between gap-2">
                      <dt>平台</dt>
                      <dd>{chatExport.export_metadata.platform}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>对话数</dt>
                      <dd>{conversationCount}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>数据等级</dt>
                      <dd>{chatExport.export_metadata.data_classification}</dd>
                    </div>
                  </dl>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-md border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <MessageSquareText className="h-4 w-4" />
              对话列表
            </div>
            <div className="space-y-2">
              {chatExport?.conversations.map((conversation) => {
                const summary = summaries.find((item) => item.conversation_id === conversation.conversation_id);
                const intent = summary?.purchase_intent[0];
                const active = conversation.conversation_id === selectedConversationId;
                return (
                  <button
                    key={conversation.conversation_id}
                    className={cn(
                      "w-full rounded-md border p-3 text-left text-sm transition-colors",
                      active ? "border-primary bg-primary/5" : "hover:bg-accent/50",
                    )}
                    onClick={() => setSelectedConversationId(conversation.conversation_id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{conversation.buyer.company_name}</span>
                      <Badge variant="outline">{conversation.buyer.country}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{conversation.buyer.display_name} · {conversation.buyer.claimed_role ?? "未提供职位"}</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {intent?.product ?? "待提取"} · {quantity(intent?.quantity)}
                    </div>
                  </button>
                );
              }) ?? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  还没有加载 Accio 对话。
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="min-w-0 space-y-4">
          <div className="rounded-md border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MessageSquareText className="h-4 w-4" />
                原始对话与提取高亮
              </div>
              {selectedConversation && (
                <Badge variant="outline">{selectedConversation.conversation_id}</Badge>
              )}
            </div>
            {selectedConversation ? (
              <div className="space-y-3">
                {!selectedSummary && (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    原始对话已加载；员工返回结构化报告前不显示提取高亮。
                  </div>
                )}
                {selectedConversation.messages.map((message, index) => (
                  <div
                    key={`${message.timestamp}-${index}`}
                    className={cn(
                      "rounded-md border p-3 text-sm leading-6",
                      message.sender === "buyer" ? "bg-emerald-50/60" : "bg-muted/30",
                    )}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={message.sender === "buyer" ? "secondary" : "outline"}>{senderLabels[message.sender]}</Badge>
                      <span>{new Date(message.timestamp).toLocaleString()}</span>
                    </div>
                    <p>{highlightText(message.text, selectedSummary)}</p>
                  </div>
                ))}
                {selectedConversation.attachments.length > 0 && (
                  <div className="rounded-md border bg-muted/30 p-3">
                    <div className="mb-2 text-sm font-medium">附件</div>
                    {selectedConversation.attachments.map((attachment) => (
                      <div key={attachment.file_name} className="text-sm text-muted-foreground">
                        {attachment.file_name} · {attachment.type} · {attachment.description ?? "无描述"}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                选择或加载一条 Accio 对话后，这里显示 transcript；提取高亮等待记忆员工返回。
              </div>
            )}
          </div>

          <div className="rounded-md border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <PackageCheck className="h-4 w-4" />
                三条模拟对话结构化报告
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!summaries.length}
                onClick={() => downloadJson("accio_summaries.json", summaries)}
              >
                <Download className="h-4 w-4" />
                导出报告 JSON
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">公司</th>
                    <th className="py-2 pr-3">产品/型号</th>
                    <th className="py-2 pr-3">数量</th>
                    <th className="py-2 pr-3">目标价</th>
                    <th className="py-2 pr-3">最佳/约定价</th>
                    <th className="py-2 pr-3">下一步</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((summary) => {
                    const intent = summary.purchase_intent[0];
                    return (
                      <tr
                        key={summary.conversation_id}
                        className={cn(
                          "cursor-pointer border-b align-top hover:bg-accent/40",
                          summary.conversation_id === selectedConversationId && "bg-primary/5",
                        )}
                        onClick={() => setSelectedConversationId(summary.conversation_id)}
                      >
                        <td className="py-3 pr-3">
                          <div className="font-medium">{summary.customer_profile.company_name}</div>
                          <div className="text-xs text-muted-foreground">{summary.customer_profile.country} · {summary.customer_profile.contact_person}</div>
                        </td>
                        <td className="py-3 pr-3">
                          <div>{intent.product}</div>
                          <div className="text-xs text-muted-foreground">{intent.models.join(", ") || "未提及具体型号"}</div>
                        </td>
                        <td className="py-3 pr-3">
                          {quantity(intent.quantity)}
                          {intent.monthly_potential_quantity && (
                            <div className="text-xs text-muted-foreground">月潜量 {quantity(intent.monthly_potential_quantity)}</div>
                          )}
                        </td>
                        <td className="py-3 pr-3">{price(intent.target_price_usd)}</td>
                        <td className="py-3 pr-3">{price(intent.seller_best_price_usd)}</td>
                        <td className="py-3 pr-3">{summary.next_actions[0]}</td>
                      </tr>
                    );
                  })}
                  {!summaries.length && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        等待记忆员工返回 ACCIO_SUMMARIES_JSON 后展示报告；加载样例只显示原始对话，不预生成报告。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-md border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Database className="h-4 w-4" />
              记忆分析预览
            </div>
            {selectedSummary ? (
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium">{selectedSummary.customer_profile.company_name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {selectedSummary.customer_profile.country} · {selectedSummary.customer_profile.role ?? "未提供职位"} · {maskEmail(selectedSummary.customer_profile.email)}
                  </div>
                  <Badge className="mt-2" variant="outline">company_evidence_status: unverified_chat_claims</Badge>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">采购意向</div>
                  {selectedSummary.purchase_intent.map((intent) => (
                    <div key={`${selectedSummary.conversation_id}-${intent.product}`} className="rounded-md border p-3 text-sm">
                      <div className="font-medium">{intent.product}</div>
                      <div className="mt-1 text-muted-foreground">{intent.models.join(", ") || "无具体型号"}</div>
                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <dt className="text-muted-foreground">数量</dt>
                        <dd>{quantity(intent.quantity)}</dd>
                        <dt className="text-muted-foreground">目标价</dt>
                        <dd>{price(intent.target_price_usd)}</dd>
                        <dt className="text-muted-foreground">最佳价</dt>
                        <dd>{price(intent.seller_best_price_usd)}</dd>
                        <dt className="text-muted-foreground">条款</dt>
                        <dd>{intent.incoterm ?? intent.logistics_terms ?? "未提及"}</dd>
                      </dl>
                    </div>
                  ))}
                </div>

                <div className="rounded-md bg-muted/40 p-3 text-sm leading-6">
                  <div className="mb-1 font-medium">谈判摘要</div>
                  {selectedSummary.negotiation_summary}
                </div>

                <div>
                  <div className="mb-2 text-xs font-medium text-muted-foreground">下一步</div>
                  <ul className="space-y-2 text-sm">
                    {selectedSummary.next_actions.map((action) => (
                      <li key={action} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-md border p-3 text-sm">
                  <div className="mb-2 flex items-center gap-2 font-medium">
                    <ShieldCheck className="h-4 w-4" />
                    行为信号
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-muted/40 p-2">
                      专业度
                      <div className="text-lg font-semibold">{selectedSummary.behavior_signals.inquiry_professionalism_points}/10</div>
                    </div>
                    <div className="rounded bg-muted/40 p-2">
                      响应
                      <div className="text-lg font-semibold">{selectedSummary.behavior_signals.responsiveness_points}/10</div>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{selectedSummary.behavior_signals.notes}</p>
                </div>

                <div className="space-y-2">
                  <Button className="w-full justify-start" variant="outline" onClick={previewMemory}>
                    <ClipboardCopy className="h-4 w-4" />
                    复制分析报告预览
                  </Button>
                  {copyMessage && <p className="text-xs text-muted-foreground">{copyMessage}</p>}
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                等待记忆员工返回报告后，这里显示 company summary、purchase intent 和 preview-only memory report。
              </div>
            )}
          </div>

          <div className="rounded-md border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Play className="h-4 w-4" />
                记忆员工执行
              </div>
              <Badge variant={canRunEmployee ? "secondary" : "outline"}>
                {gatewayState === "connected" ? (accioAgent ? "员工已连接" : "未注册") : "Gateway 未连接"}
              </Badge>
            </div>
            {(agentError || (!agentLoading && gatewayState === "connected" && !accioAgent)) && (
              <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                {agentError ?? "cbe-accio-memory 未注册。请运行 scripts/sentura-setup.sh 后重试。"}
              </div>
            )}
            <Button className="mb-3 w-full justify-start" onClick={runEmployee} disabled={!chatExport || runStatus === "loading"}>
              {runStatus === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              让记忆员工分析
            </Button>
            <AgentChat
              ref={chatRef}
              agentId={ACCIO_AGENT_ID}
              sessionKey={accioSessionKey}
              sessionLabel="CBE Accio memory processing"
              onSessionCreated={setAccioSessionKey}
              onMessage={handleEmployeeMessage}
              hiddenUserPrefixes={[ACCIO_TASK_PREFIX]}
              className="h-[420px]"
              emptyState={
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  加载样例后点击上方按钮，真实员工会调用 Accio 解析/摘要技能并返回结构化 JSON。
                </div>
              }
            />
          </div>
        </section>
      </main>
    </div>
  );
}
