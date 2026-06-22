/**
 * Pure aggregation helpers for cost events.
 *
 * Kept side-effect-free so unit tests can hand them synthetic
 * `CostEvent[]` arrays without touching the JSONL store. The store
 * delegates the actual rollup to these functions on every
 * `sentura.cost.summary` RPC.
 */

import type { CostAggregateBucket, CostEvent, CostSummary } from "./types.js";

function emptyBucket(key: string): CostAggregateBucket {
  return { key, totalCalls: 0, totalTokens: 0, totalCostUsd: 0, unpricedCalls: 0 };
}

function bucketAdd(bucket: CostAggregateBucket, event: CostEvent): void {
  bucket.totalCalls += 1;
  bucket.totalTokens += event.usage.totalTokens;
  if (event.costUsd === null) {
    bucket.unpricedCalls += 1;
  } else {
    bucket.totalCostUsd += event.costUsd;
  }
}

function aggregateBy(
  events: CostEvent[],
  keyFn: (e: CostEvent) => string,
): CostAggregateBucket[] {
  const map = new Map<string, CostAggregateBucket>();
  for (const event of events) {
    const key = keyFn(event);
    let bucket = map.get(key);
    if (!bucket) {
      bucket = emptyBucket(key);
      map.set(key, bucket);
    }
    bucketAdd(bucket, event);
  }
  // Sort by totalCostUsd desc; unpriced buckets sink to the bottom.
  return Array.from(map.values()).sort((a, b) => b.totalCostUsd - a.totalCostUsd);
}

export function aggregateByAgent(events: CostEvent[]): CostAggregateBucket[] {
  return aggregateBy(events, (e) => e.agentId);
}

export function aggregateByDepartment(events: CostEvent[]): CostAggregateBucket[] {
  // `null` department becomes the literal key "(unassigned)" so it shows
  // up cleanly in the dashboard instead of silently grouping with the
  // empty string.
  return aggregateBy(events, (e) => e.departmentId ?? "(unassigned)");
}

export function aggregateByTenant(events: CostEvent[]): CostAggregateBucket[] {
  return aggregateBy(events, (e) => e.tenantId);
}

export function aggregateByModel(events: CostEvent[]): CostAggregateBucket[] {
  return aggregateBy(events, (e) => `${e.provider}/${e.model}`);
}

export function aggregateByUser(events: CostEvent[]): CostAggregateBucket[] {
  return aggregateBy(events, (e) => e.userToken || "(anonymous)");
}

export function summarize(
  events: CostEvent[],
  period: { start: string; end: string },
): CostSummary {
  let totalCalls = 0;
  let totalTokens = 0;
  let totalCostUsd = 0;
  let unpricedCalls = 0;
  for (const event of events) {
    totalCalls += 1;
    totalTokens += event.usage.totalTokens;
    if (event.costUsd === null) unpricedCalls += 1;
    else totalCostUsd += event.costUsd;
  }
  return {
    period,
    totalCalls,
    totalTokens,
    totalCostUsd,
    unpricedCalls,
    byAgent: aggregateByAgent(events),
    byDepartment: aggregateByDepartment(events),
    byTenant: aggregateByTenant(events),
    byModel: aggregateByModel(events),
  };
}
