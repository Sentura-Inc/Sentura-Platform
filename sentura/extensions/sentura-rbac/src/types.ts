export const SENTURA_ROLES = [
  "platform_admin",
  "manager",
  "ekg_manager",
  "agent_manager",
  "auditor",
  "end_user",
  "viewer",
] as const;

export type SenturaRole = (typeof SENTURA_ROLES)[number];

export const DATA_TIERS = ["T0", "T1", "T2", "T3", "T4"] as const;
export type DataTier = (typeof DATA_TIERS)[number];

export type PermissionScope = "all" | "department" | "owned" | "self";

export interface SenturaPermission {
  resource: string;
  actions: readonly string[];
  scope: PermissionScope;
}

export interface RoleDefinition {
  id: SenturaRole;
  name: string;
  description: string;
  operatorScopes: readonly string[];
  permissions: readonly SenturaPermission[];
  dataTierAccess: readonly DataTier[];
}

export interface SenturaUser {
  id: string;
  email: string;
  name: string;
  role: SenturaRole;
  userToken: string;
  departmentIds: string[];
  ownedEmployeeIds: string[];
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface Department {
  id: string;
  name: string;
  parentId?: string;
  employeeIds: string[];
  adminUserIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RbacConfig {
  dataDir: string;
  defaultRole: SenturaRole;
  enforceOnPluginMethods: boolean;
}

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  filteredScope?: PermissionScope;
}
