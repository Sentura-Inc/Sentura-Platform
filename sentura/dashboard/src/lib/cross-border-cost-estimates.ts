import type { CostEvent, CostPricingStatus } from "./gateway/types";

type ExternalUsage = NonNullable<CostEvent["externalUsage"]>;

interface EstimateInput {
  provider?: string | null;
  service?: string | null;
  operation?: string | null;
  model?: string | null;
  toolName?: string | null;
  sourceType?: string | null;
  endpoint?: string | null;
  requestUnits?: number | null;
  externalUsage?: ExternalUsage;
  httpStatus?: number | null;
}

export interface CostEstimateResult {
  costUsd: number;
  pricingStatus: CostPricingStatus;
  pricingNote: string;
  externalUsage?: ExternalUsage;
}

function finiteNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envNumber(name: string, fallback: number) {
  return finiteNumber(process.env[name], fallback);
}

function money(value: number) {
  const rounded = Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function usageQuantity(input: EstimateInput, fallback = 1) {
  return input.externalUsage?.quantity ?? input.requestUnits ?? fallback;
}

function haystack(input: EstimateInput) {
  return [
    input.provider,
    input.service,
    input.operation,
    input.model,
    input.toolName,
    input.sourceType,
    input.endpoint,
  ].filter(Boolean).join(" ").toLowerCase();
}

function estimatedRatePerThousandCost(
  input: EstimateInput,
  perThousandUsd: number,
  skuLabel: string,
  sourceLabel: string,
) {
  const quantity = usageQuantity(input);
  return {
    costUsd: money((quantity * perThousandUsd) / 1000),
    pricingStatus: "estimated" as const,
    pricingNote:
      `${sourceLabel} 按官方 ${skuLabel} 主价格 ${perThousandUsd.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      })}/1000 billable events 折算；Google 项目级 5,000 免费事件、阶梯折扣、税费或合同价未在单条事件中返回，因此这里显示可审计的边际预估价。`,
  };
}

function includedCost(pricingNote: string, externalUsage?: ExternalUsage): CostEstimateResult {
  return {
    costUsd: 0,
    pricingStatus: "included",
    pricingNote,
    externalUsage,
  };
}

export function estimateApiLedgerExternalCost(input: EstimateInput): CostEstimateResult | null {
  const text = haystack(input);

  if (
    text.includes("google_address_validate") ||
    text.includes("address_validation") ||
    text.includes("validateaddress") ||
    text.includes("google_maps_address_validation")
  ) {
    return estimatedRatePerThousandCost(
      input,
      envNumber("CBE_GOOGLE_ADDRESS_VALIDATION_PRO_PER_1000_USD", 17),
      "Address Validation Pro",
      "Google Maps Address Validation",
    );
  }

  if (
    text.includes("google_place_details") ||
    text.includes("places/{place_id}") ||
    text.includes("place details")
  ) {
    return estimatedRatePerThousandCost(
      input,
      envNumber("CBE_GOOGLE_PLACE_DETAILS_PRO_PER_1000_USD", 17),
      "Place Details Pro",
      "Google Maps Places Details",
    );
  }

  if (
    text.includes("google_places_search") ||
    text.includes("places:searchtext") ||
    text.includes("places:searchnearby") ||
    text.includes("text search pro") ||
    text.includes("nearby search pro")
  ) {
    return estimatedRatePerThousandCost(
      input,
      envNumber("CBE_GOOGLE_PLACES_SEARCH_PRO_PER_1000_USD", 32),
      "Text/Nearby Search Pro",
      "Google Maps Places Search",
    );
  }

  if (text.includes("abstract") || text.includes("paid-email-validation")) {
    const monthlyUsd = envNumber("CBE_ABSTRACT_EMAIL_REPUTATION_MONTHLY_USD", 17);
    const monthlyRequests = envNumber("CBE_ABSTRACT_EMAIL_REPUTATION_MONTHLY_REQUESTS", 5000);
    const quantity = usageQuantity(input);
    return {
      costUsd: money((quantity * monthlyUsd) / Math.max(monthlyRequests, 1)),
      pricingStatus: "estimated",
      pricingNote:
        `Abstract Email Reputation 按月付 ${monthlyUsd.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
        })}/${monthlyRequests.toLocaleString("en-US")} requests 折算；免费额度、账号折扣或合同价未在事件中返回。`,
    };
  }

  if (text.includes("hunter") || text.includes("email-verifier")) {
    const monthlyUsd = envNumber("CBE_HUNTER_STARTER_MONTHLY_USD", 49);
    const monthlyCredits = envNumber("CBE_HUNTER_STARTER_MONTHLY_CREDITS", 2000);
    const verifierCredits = envNumber("CBE_HUNTER_EMAIL_VERIFIER_CREDITS", 0.5);
    const creditQuantity = input.externalUsage?.unit === "credit"
      ? usageQuantity(input, verifierCredits)
      : verifierCredits * usageQuantity(input);
    if (input.httpStatus && input.httpStatus >= 400) {
      return includedCost(
        `Hunter Email Verifier 返回 HTTP ${input.httpStatus}；按 Hunter 失败/未知验证不计 verification credit 的规则，本次预估为 ${money(0).toFixed(2)} 美元。成功验证时按 ${verifierCredits} credit/次、Starter ${monthlyUsd.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
        })}/${monthlyCredits.toLocaleString("en-US")} credits 折算。`,
        input.externalUsage,
      );
    }
    return {
      costUsd: money((creditQuantity * monthlyUsd) / Math.max(monthlyCredits, 1)),
      pricingStatus: "estimated",
      pricingNote:
        `Hunter Email Verifier 按 ${verifierCredits} credit/verified email，Starter ${monthlyUsd.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
        })}/${monthlyCredits.toLocaleString("en-US")} credits 折算；同一账期重复验证、失败验证、账号折扣未在事件中返回。`,
      externalUsage: input.externalUsage ?? {
        unit: "credit",
        quantity: creditQuantity,
        label: `${creditQuantity.toLocaleString("zh-CN")} credit`,
      },
    };
  }

  if (
    text.includes("importyeti") ||
    text.includes("paid-trade-data") ||
    text.includes("paid_trade_data") ||
    text.includes("screening-trade-data")
  ) {
    return includedCost(
      "ImportYeti `GET /v1.0/company/search` 官方标注为不消耗 purchased data credits；当前 Sentura 贸易资料搜索使用该 company search 路径，因此预估为 0 美元。",
    );
  }

  if (
    text.includes("public_registry") ||
    text.includes("company registry") ||
    text.includes("companies house") ||
    text.includes("public registry")
  ) {
    return includedCost(
      "公共公司注册资料查询按公开/套餐内资料源处理，当前事件未返回第三方美元扣费，预估为 0 美元。",
    );
  }

  return null;
}

export function applyEstimatedCostToEvent(event: CostEvent): CostEvent {
  if (event.costUsd !== null || event.pricingStatus === "free" || event.pricingStatus === "included") {
    return event;
  }
  const estimate = estimateApiLedgerExternalCost({
    provider: event.provider,
    service: event.service,
    operation: event.operation,
    model: event.model,
    toolName: event.toolName,
    externalUsage: event.externalUsage,
    httpStatus: event.httpStatus,
  });
  if (!estimate) return event;
  return {
    ...event,
    costUsd: estimate.costUsd,
    pricingStatus: estimate.pricingStatus,
    pricingNote: estimate.pricingNote,
    externalUsage: estimate.externalUsage ?? event.externalUsage,
  };
}

export function applyEstimatedCostToEvents(events: CostEvent[]) {
  return events.map(applyEstimatedCostToEvent);
}
