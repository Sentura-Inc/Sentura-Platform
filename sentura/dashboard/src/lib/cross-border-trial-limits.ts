export const CBE_TRIAL_OPERATOR_ACCOUNT_LIMIT = 3;
export const CBE_TRIAL_LEAD_SUCCESS_LIMIT = 300;
export const CBE_TRIAL_SCREENING_SUCCESS_LIMIT = 300;

export type CbeTrialUsageKind = "lead_success" | "screening_success";

export interface CbeTrialLimitBucket {
  limit: number;
  used: number;
  remaining: number;
  exhausted: boolean;
}

export interface CbeTrialLimitsSnapshot {
  enabled: true;
  locked: true;
  operatorAccounts: CbeTrialLimitBucket;
  leadSuccesses: CbeTrialLimitBucket;
  screeningSuccesses: CbeTrialLimitBucket;
  updatedAt: string;
}

export function cbeTrialLimitBucket(used: number, limit: number): CbeTrialLimitBucket {
  const safeUsed = Math.max(0, Math.floor(Number.isFinite(used) ? used : 0));
  const safeLimit = Math.max(0, Math.floor(Number.isFinite(limit) ? limit : 0));
  const remaining = Math.max(0, safeLimit - safeUsed);
  return {
    limit: safeLimit,
    used: safeUsed,
    remaining,
    exhausted: remaining <= 0,
  };
}
