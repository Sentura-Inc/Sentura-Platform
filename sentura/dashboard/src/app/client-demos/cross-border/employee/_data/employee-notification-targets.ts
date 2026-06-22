import type { CbeEmployeeTaskRecord } from "@/stores/use-cbe-employee-store";

export const EMPLOYEE_NOTIFICATION_PREVIEW_LIMIT = 10;
export const EMPLOYEE_NOTIFICATION_VISIBLE_COUNT = 3;
export const EMPLOYEE_MESSAGE_CENTER_HREF = "/client-demos/cross-border/employee#employee-messages";
export const EMPLOYEE_API_COST_ELEMENT_ID = "employee-api-cost";
export const EMPLOYEE_API_COST_HIGHLIGHT_PARAM = "highlightCost";
export const EMPLOYEE_NOTIFICATION_HIGHLIGHT_CLASS =
  "animate-pulse outline outline-2 -outline-offset-2 outline-sky-300 shadow-[0_0_0_3px_rgba(125,211,252,0.22)]";

const employeeCustomerPagePath = "/client-demos/cross-border/employee/customers";
const employeeHomePath = "/client-demos/cross-border/employee";

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function metadataValue(task: CbeEmployeeTaskRecord, key: string) {
  return stringValue(task.metadata?.[key]);
}

export function isEmployeeCostNotification(task: CbeEmployeeTaskRecord) {
  const notificationKind = metadataValue(task, "notification_kind");
  if (notificationKind.startsWith("cost_")) return true;
  if (task.id.startsWith("cost_notice_")) return true;

  const text = [task.title, task.message, task.targetLabel]
    .map((item) => item ?? "")
    .join(" ");
  return [
    "API 成本",
    "API成本",
    "成本限额",
    "基础成本限额",
    "成本额度",
    "临时额度",
    "超额申请",
    "请求额度",
    "批准额度",
  ].some((keyword) => text.includes(keyword));
}

export function employeeCostHighlightHref(messageId?: string) {
  const params = new URLSearchParams({
    [EMPLOYEE_API_COST_HIGHLIGHT_PARAM]: "api",
  });
  if (messageId) params.set("highlightMessage", messageId);
  return `${employeeHomePath}?${params.toString()}#${EMPLOYEE_API_COST_ELEMENT_ID}`;
}

export function employeeTaskNotificationHref(task: CbeEmployeeTaskRecord) {
  if (isEmployeeCostNotification(task)) {
    return employeeCostHighlightHref(task.id);
  }
  return `${employeeCustomerPagePath}?highlightTask=${encodeURIComponent(task.id)}`;
}
