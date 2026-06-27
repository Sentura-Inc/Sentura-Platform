import { redirect } from "next/navigation";
import { CBE_ADMIN_EMPLOYEES_PATH } from "@/lib/cross-border-routes";

export default function AdminIndexPage() {
  redirect(CBE_ADMIN_EMPLOYEES_PATH);
}
