export const CBE_EMPLOYEE_HOME_PATH = "/employee";
export const CBE_EMPLOYEE_LOGIN_PATH = "/employee/login";
export const CBE_EMPLOYEE_CUSTOMERS_PATH = "/employee/customers";
export const CBE_EMPLOYEE_MEMORY_PATH = "/employee/memory";

export const CBE_ADMIN_HOME_PATH = "/admin";
export const CBE_ADMIN_LOGIN_PATH = "/admin/login";
export const CBE_ADMIN_EMPLOYEES_PATH = "/admin/employees";
export const CBE_ADMIN_HIGH_VALUE_CUSTOMERS_PATH = "/admin/high-value-customers";
export const CBE_ADMIN_COSTS_PATH = "/admin/costs";

export const CBE_EMPLOYEE_API_BASE = "/api/employee";
export const CBE_ADMIN_API_BASE = "/api/admin";
export const CBE_SESSION_API_PATH = "/api/session";

export const CBE_INTERNAL_EMPLOYEE_BASE_PATH = "/client-demos/cross-border/employee";
export const CBE_INTERNAL_ADMIN_BASE_PATH = "/client-demos/cross-border/admin";
export const CBE_INTERNAL_EMPLOYEE_API_BASE = "/api/client-demos/cross-border/employee";
export const CBE_INTERNAL_ADMIN_API_BASE = "/api/client-demos/cross-border/admin";
export const CBE_INTERNAL_SESSION_API_PATH = "/api/client-demos/cross-border/session";

export const CBE_LEGACY_EMPLOYEE_BASE_PATH = CBE_INTERNAL_EMPLOYEE_BASE_PATH;
export const CBE_LEGACY_ADMIN_BASE_PATH = CBE_INTERNAL_ADMIN_BASE_PATH;

function matchesPath(pathname: string, basePath: string) {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

export function isCbeEmployeePath(pathname: string) {
  return matchesPath(pathname, CBE_EMPLOYEE_HOME_PATH) || matchesPath(pathname, CBE_INTERNAL_EMPLOYEE_BASE_PATH);
}

export function isCbeEmployeeLoginPath(pathname: string) {
  return matchesPath(pathname, CBE_EMPLOYEE_LOGIN_PATH);
}

export function isCbeAdminPath(pathname: string) {
  return matchesPath(pathname, CBE_ADMIN_HOME_PATH) || matchesPath(pathname, CBE_INTERNAL_ADMIN_BASE_PATH);
}

export function isCbeAdminLoginPath(pathname: string) {
  return matchesPath(pathname, CBE_ADMIN_LOGIN_PATH) || matchesPath(pathname, `${CBE_INTERNAL_ADMIN_BASE_PATH}/login`);
}
