"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, RefreshCw, RotateCcw, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_LEAD_FILTER_SETTINGS,
  type LeadBuyerTypeOption,
  type LeadCountryOption,
  type LeadFilterSettings,
  type LeadProductOption,
} from "@/lib/cross-border-lead-settings";
import {
  fetchAdminLeadFilterSettings,
  updateAdminLeadFilterSettings,
} from "../_data/admin-api";

type KeywordGroup = "products" | "buyerTypes";

const COUNTRY_HINTS: Record<string, { code: string; language: string }> = {
  英国: { code: "GB", language: "en" },
  美国: { code: "US", language: "en" },
  德国: { code: "DE", language: "de" },
  法国: { code: "FR", language: "fr" },
  巴西: { code: "BR", language: "pt" },
  墨西哥: { code: "MX", language: "es" },
  加拿大: { code: "CA", language: "en" },
  澳大利亚: { code: "AU", language: "en" },
  西班牙: { code: "ES", language: "es" },
  意大利: { code: "IT", language: "it" },
  荷兰: { code: "NL", language: "nl" },
  阿联酋: { code: "AE", language: "ar" },
  沙特阿拉伯: { code: "SA", language: "ar" },
  日本: { code: "JP", language: "ja" },
  韩国: { code: "KR", language: "ko" },
  印度: { code: "IN", language: "en" },
};

function asciiSlugFromText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function chineseSlugFromText(value: string, fallback: string) {
  const ascii = asciiSlugFromText(value);
  if (ascii) return ascii;
  const codepoints = Array.from(value.trim())
    .map((char) => char.codePointAt(0)?.toString(36))
    .filter(Boolean)
    .join("-");
  return codepoints ? `${fallback}-${codepoints}`.slice(0, 60).replace(/-$/g, "") : fallback;
}

function nextId(existingIds: string[], seed: string, fallback = "option") {
  const base = chineseSlugFromText(seed, fallback);
  if (!existingIds.includes(base)) return base;
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${base}-${index}`;
    if (!existingIds.includes(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function cloneSettings(settings: LeadFilterSettings): LeadFilterSettings {
  return {
    products: settings.products.map((item) => ({ ...item })),
    buyerTypes: settings.buyerTypes.map((item) => ({ ...item })),
    countries: settings.countries.map((item) => ({ ...item })),
    updatedAt: settings.updatedAt ?? null,
    updatedByUserId: settings.updatedByUserId ?? null,
    source: settings.source ?? "default",
  };
}

function trimKeywordOptions<T extends LeadProductOption | LeadBuyerTypeOption>(items: T[], fallback: string): T[] {
  const usedIds: string[] = [];
  return items.map((item) => {
    const label = item.label.trim();
    const id = nextId(usedIds, label || item.id, fallback);
    usedIds.push(id);
    return {
      ...item,
      id,
      label,
      keyword: label,
      description: item.description.trim(),
    };
  });
}

function trimCountryOptions(items: LeadCountryOption[]): LeadCountryOption[] {
  const usedCodes = new Set<string>();
  return items.map((item, index) => {
    const label = item.label.trim();
    const hint = COUNTRY_HINTS[label];
    const currentCode = item.code.trim().toUpperCase();
    const preferredCode = hint?.code ?? (/^[A-Z]{2}$/.test(currentCode) ? currentCode : "");
    const code = preferredCode && !usedCodes.has(preferredCode) ? preferredCode : nextFallbackCountryCode(usedCodes, index);
    usedCodes.add(code);
    return {
      ...item,
      code,
      label,
      language: (hint?.language ?? (item.language.trim() || "zh")).toLowerCase(),
      description: item.description.trim(),
    };
  });
}

function nextFallbackCountryCode(usedCodes: Set<string>, index: number) {
  const candidates = ["ZZ", "ZX", "ZQ", "ZY", "ZV", "ZU", "ZT", "ZS", "ZR", "ZP", "ZO", "ZN"];
  for (const candidate of candidates) {
    if (!usedCodes.has(candidate)) return candidate;
  }
  const letter = String.fromCharCode(65 + (index % 26));
  return usedCodes.has(`X${letter}`) ? `Q${letter}` : `X${letter}`;
}

function formatTime(value?: string | null) {
  if (!value) return "尚未保存";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "尚未保存";
  return date.toLocaleString("zh-CN", { hour12: false });
}

export default function AdminLeadSettingsPage() {
  const [settings, setSettings] = useState<LeadFilterSettings>(() => cloneSettings(DEFAULT_LEAD_FILTER_SETTINGS));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      products: settings.products.length,
      buyerTypes: settings.buyerTypes.length,
      countries: settings.countries.length,
    }),
    [settings],
  );

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdminLeadFilterSettings();
      setSettings(cloneSettings(result.settings));
    } catch (err) {
      setError(err instanceof Error ? err.message : "获客设置加载失败。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function updateKeyword(group: KeywordGroup, index: number, patch: Partial<LeadProductOption>) {
    setSettings((current) => ({
      ...current,
      [group]: current[group].map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  }

  function addKeyword(group: KeywordGroup) {
    setSettings((current) => {
      const existingIds = current[group].map((item) => item.id);
      const next = {
        id: nextId(existingIds, "", group === "products" ? "product" : "buyer-type"),
        label: "",
        keyword: "",
        description: "",
      };
      return { ...current, [group]: [...current[group], next] };
    });
  }

  function removeKeyword(group: KeywordGroup, index: number) {
    setSettings((current) => {
      if (current[group].length <= 1) return current;
      return { ...current, [group]: current[group].filter((_, itemIndex) => itemIndex !== index) };
    });
  }

  function updateCountry(index: number, patch: Partial<LeadCountryOption>) {
    setSettings((current) => ({
      ...current,
      countries: current.countries.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  }

  function addCountry() {
    setSettings((current) => {
      const used = new Set(current.countries.map((item) => item.code.toUpperCase()));
      const code = nextFallbackCountryCode(used, current.countries.length);
      return {
        ...current,
        countries: [
          ...current.countries,
          { code, label: "", language: "en", description: "" },
        ],
      };
    });
  }

  function removeCountry(index: number) {
    setSettings((current) => {
      if (current.countries.length <= 1) return current;
      return { ...current, countries: current.countries.filter((_, itemIndex) => itemIndex !== index) };
    });
  }

  function resetDefaults() {
    setSettings(cloneSettings(DEFAULT_LEAD_FILTER_SETTINGS));
    setNotice(null);
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload: LeadFilterSettings = {
        products: trimKeywordOptions(settings.products, "product"),
        buyerTypes: trimKeywordOptions(settings.buyerTypes, "buyer-type"),
        countries: trimCountryOptions(settings.countries),
      };
      const result = await updateAdminLeadFilterSettings(payload);
      setSettings(cloneSettings(result.settings));
      setNotice("获客筛选条件已保存。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "获客设置保存失败。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">获客设置</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            只需要输入中文业务词。英文搜索词、国家代码、语言和查询扩展由获客员工在执行时理解和处理。
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">产品 {counts.products}</Badge>
            <Badge variant="secondary">买家类型 {counts.buyerTypes}</Badge>
            <Badge variant="secondary">国家 {counts.countries}</Badge>
            <span className="text-sm text-muted-foreground">更新于 {formatTime(settings.updatedAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void refresh()} disabled={loading || saving}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            刷新
          </Button>
          <Button variant="outline" onClick={resetDefaults} disabled={saving}>
            <RotateCcw className="h-4 w-4" />
            恢复默认
          </Button>
          <Button onClick={() => void save()} disabled={loading || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存配置
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3 text-base">
            产品关键词
            <Button size="sm" variant="outline" onClick={() => addKeyword("products")} disabled={saving}>
              <Plus className="h-4 w-4" />
              新增产品
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.products.map((item, index) => (
            <div key={`${item.id}-${index}`} className="grid gap-2 rounded-md border bg-background p-3 md:grid-cols-[1fr_auto]">
              <Input value={item.label} onChange={(event) => updateKeyword("products", index, { label: event.target.value })} placeholder="中文产品词，例如：手机壳" />
              <Button
                variant="outline"
                size="icon"
                aria-label="删除产品"
                onClick={() => removeKeyword("products", index)}
                disabled={settings.products.length <= 1 || saving}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3 text-base">
            买家类型
            <Button size="sm" variant="outline" onClick={() => addKeyword("buyerTypes")} disabled={saving}>
              <Plus className="h-4 w-4" />
              新增类型
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.buyerTypes.map((item, index) => (
            <div key={`${item.id}-${index}`} className="grid gap-2 rounded-md border bg-background p-3 md:grid-cols-[1fr_auto]">
              <Input value={item.label} onChange={(event) => updateKeyword("buyerTypes", index, { label: event.target.value })} placeholder="中文买家类型，例如：维修连锁" />
              <Button
                variant="outline"
                size="icon"
                aria-label="删除买家类型"
                onClick={() => removeKeyword("buyerTypes", index)}
                disabled={settings.buyerTypes.length <= 1 || saving}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3 text-base">
            国家 / 地区
            <Button size="sm" variant="outline" onClick={addCountry} disabled={saving}>
              <Plus className="h-4 w-4" />
              新增国家
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.countries.map((item, index) => (
            <div key={`${item.code}-${index}`} className="grid gap-2 rounded-md border bg-background p-3 md:grid-cols-[1fr_auto]">
              <Input value={item.label} onChange={(event) => updateCountry(index, { label: event.target.value })} placeholder="中文国家或地区，例如：英国" />
              <Button
                variant="outline"
                size="icon"
                aria-label="删除国家"
                onClick={() => removeCountry(index)}
                disabled={settings.countries.length <= 1 || saving}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
