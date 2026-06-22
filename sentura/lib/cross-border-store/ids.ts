import { randomUUID } from "node:crypto";

export const CBE_TENANT_ID = "cross-border-ecommerce";
export const CBE_TENANT_SLUG = "cross-border-ecommerce";
export const CBE_TENANT_DISPLAY_NAME = "Cross-border E-commerce";
export const CBE_DATA_REGION = "cn-south";

export const CBE_SEED_USERS = {
  admin: {
    id: "cbe-user-admin-001",
    profileId: "cbe-profile-admin-001",
    displayName: "孙总",
    defaultPassword: "1234",
    role: "customer_admin",
    departmentId: "sales",
    cbeRole: "admin",
    teamName: "Shenzhen Sales",
  },
  operatorA: {
    id: "cbe-user-operator-001",
    profileId: "cbe-profile-operator-001",
    displayName: "Lin Yue",
    role: "customer_operator",
    departmentId: "sales",
    cbeRole: "operator",
    teamName: "Shenzhen Sales A",
  },
  operatorB: {
    id: "cbe-user-operator-002",
    profileId: "cbe-profile-operator-002",
    displayName: "Chen Wei",
    role: "customer_operator",
    departmentId: "sales",
    cbeRole: "operator",
    teamName: "Shenzhen Sales B",
  },
} as const;

export type CbeSeedUserKey = keyof typeof CBE_SEED_USERS;

export function createCbeId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}
