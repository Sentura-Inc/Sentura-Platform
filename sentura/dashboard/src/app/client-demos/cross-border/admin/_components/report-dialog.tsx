"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function text(value: unknown, fallback = "-") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function displayText(value: unknown, fallback = "-") {
  const source = text(value, fallback);
  return source
    .replace(/外部可追溯证据 URL/g, "可核验来源")
    .replace(/可追溯证据 URL/g, "可核验来源")
    .replace(/来源 URL/g, "来源链接")
    .replace(/证据 URL/g, "核验来源")
    .replace(/工具返回 URL/g, "工具返回的来源链接")
    .replace(/\brdap\b/gi, "域名登记信息")
    .replace(/\bdns\b/gi, "域名解析")
    .replace(/\bjson\b/gi, "结构化结果")
    .replace(/\bsec\b/gi, "财务公开信息")
    .replace(/\bkyb\b/gi, "企业核验")
    .replace(/\bapi_error\b/gi, "查询失败")
    .replace(/\bAPI authorization failure\b/gi, "工具权限异常")
    .replace(/\bAPI\b/gi, "工具查询")
    .replace(/\bHTTP 401\b/gi, "查询权限错误")
    .replace(/\bHTTP \d{3}\b/gi, "查询返回")
    .replace(/\bMX\b/gi, "收信设置")
    .replace(/\bSPF\b/gi, "发信设置")
    .replace(/\bDMARC\b/gi, "邮件安全设置")
    .replace(/\bendpoint\b/gi, "查询入口")
    .replace(/\bprovider\b/gi, "工具")
    .replace(/\bobjectClassName\b/g, "对象类型")
    .replace(/\bself link\b/gi, "来源链接")
    .replace(/\blookup\b/gi, "查询")
    .replace(/\bredirected\b/gi, "跳转")
    .replace(/\breturned\b/gi, "返回")
    .replace(/\binvalid_mailbox\b/gi, "邮箱不可达")
    .replace(/\bundeliverable\b/gi, "邮箱不可达");
}

function numberText(value: unknown, suffix = "") {
  return typeof value === "number" && Number.isFinite(value) ? `${value}${suffix}` : "-";
}

function plainGapText(value: unknown) {
  if (typeof value === "string") return displayText(value);
  const record = asRecord(value);
  return displayText(record.reason ?? record.summary ?? record.action ?? record.block, "暂无需要补充的内容。");
}

function readableSourceType(value: unknown) {
  const raw = text(value, "");
  const normalized = raw.toLowerCase();
  if (!raw) return "公开资料";
  if (normalized.includes("registry")) return "官方注册资料";
  if (normalized.includes("dns") || normalized.includes("rdap") || normalized.includes("domain")) return "官网和邮箱资料";
  if (normalized.includes("web")) return "公开网页";
  if (normalized.includes("map") || normalized.includes("place")) return "公开地址资料";
  if (normalized.includes("trade") || normalized.includes("custom")) return "贸易资料";
  if (normalized.includes("financial") || normalized.includes("filing")) return "财务公开资料";
  return "公开资料";
}

export function ScreeningReportDialog({
  report,
  triggerLabel = "查看报告",
}: {
  report: JsonRecord | null | undefined;
  triggerLabel?: string;
}) {
  const body = asRecord(report);
  const target = asRecord(body.target);
  const scoreBlocks = asArray(body.score_blocks);
  const evidence = asArray(body.evidence);
  const gaps = Array.isArray(body.coverage_gaps) ? body.coverage_gaps : [];
  const questions = Array.isArray(body.open_questions) ? body.open_questions : [];

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" disabled={!report} />}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="max-h-[86vh] max-w-5xl">
        <DialogHeader>
          <DialogTitle>{text(body.company_name ?? target.company_name, "完整背调报告")}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[72vh] pr-3">
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">跟进评级</div>
                <div className="mt-1 text-sm font-semibold">{text(body.risk_tier)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">评分</div>
                <div className="mt-1 text-sm font-semibold">{numberText(body.normalized_score)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">证据覆盖</div>
                <div className="mt-1 text-sm font-semibold">
                  {typeof body.evidence_coverage === "number" ? `${Math.round(body.evidence_coverage * 100)}%` : "-"}
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">建议动作</div>
                <div className="mt-1 text-sm font-semibold">{displayText(body.recommended_action)}</div>
              </div>
            </div>

            <section>
              <h3 className="text-sm font-semibold">评分明细</h3>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {scoreBlocks.map((block, index) => (
                  <div key={`${text(block.block)}-${index}`} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{text(block.block)}</span>
                      <Badge variant="outline">{text(block.status)}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      得分 {numberText(block.earned_points)} / {numberText(block.max_points)}
                    </div>
                    <p className="mt-2 text-sm leading-6">{displayText(block.reason ?? block.summary)}</p>
                  </div>
                ))}
                {scoreBlocks.length === 0 ? <p className="text-sm text-muted-foreground">暂无评分明细。</p> : null}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold">核验依据</h3>
              <div className="mt-2 space-y-2">
                {evidence.map((item, index) => {
                  const url = text(item.source_url ?? item.url, "");
                  return (
                    <div key={`${url}-${index}`} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{readableSourceType(item.source_type ?? item.layer)}</Badge>
                        <span>{text(item.fetched_at)}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6">{displayText(item.finding)}</p>
                      {url ? (
                        <a className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" href={url} target="_blank" rel="noreferrer">
                          查看来源
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                  );
                })}
                {evidence.length === 0 ? <p className="text-sm text-muted-foreground">暂无核验依据。</p> : null}
              </div>
            </section>

            <section className="grid gap-3 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold">还缺什么</h3>
                <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {gaps.map((gap, index) => <p key={index}>{plainGapText(gap)}</p>)}
                  {gaps.length === 0 ? <p>暂无需要补充的内容。</p> : null}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold">待确认问题</h3>
                <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {questions.map((question, index) => <p key={index}>{displayText(question)}</p>)}
                  {questions.length === 0 ? <p>暂无待确认问题。</p> : null}
                </div>
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
