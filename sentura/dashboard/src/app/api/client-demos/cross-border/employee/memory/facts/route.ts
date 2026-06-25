import {
  cbeRouteError,
  CbeStoreError,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    await request.text().catch(() => "");
    throw new CbeStoreError(
      410,
      "memory_fact_review_disabled",
      "记忆整理已与长期记忆写入分离，不能写入长期记忆。",
    );
  } catch (error) {
    return cbeRouteError(error);
  }
}
