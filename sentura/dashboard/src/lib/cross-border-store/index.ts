export const CBE_STORE_REQUIRED_ENV = "CBE_DATABASE_URL";
export const CBE_PRODUCT_ROLES = ["admin", "operator"] as const;
export const CBE_OPERATOR_SURFACES = ["personal", "customers", "memory"] as const;
export const CBE_ADMIN_MONITORING_MODULES = [
  "overview",
  "live-tasks",
  "customers",
  "operators",
  "agent-usage",
] as const;

export type CbeProductRole = (typeof CBE_PRODUCT_ROLES)[number];
export type CbeOperatorSurface = (typeof CBE_OPERATOR_SURFACES)[number];
export type CbeAdminMonitoringModule = (typeof CBE_ADMIN_MONITORING_MODULES)[number];
