import { redirect } from "next/navigation";
import { CBE_EMPLOYEE_HOME_PATH } from "@/lib/cross-border-routes";

export default function DashboardPage() {
  redirect(CBE_EMPLOYEE_HOME_PATH);
}
