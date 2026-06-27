import {
  CbeStoreError,
  cbeRouteError,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH() {
  try {
    throw new CbeStoreError(
      410,
      "memory_fact_review_disabled",
      "长期记忆在分析完成后自动写入，此接口已停用。",
    );
  } catch (error) {
    return cbeRouteError(error);
  }
}
