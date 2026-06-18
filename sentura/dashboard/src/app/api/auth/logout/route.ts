import { NextResponse } from "next/server";
import {
  CBE_SESSION_COOKIES,
  CBE_SESSION_COOKIE,
  cbeSessionCookieNameForRole,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  const role = new URL(request.url).searchParams.get("role");
  const cookieNames = role === "admin" || role === "operator"
    ? [CBE_SESSION_COOKIE, cbeSessionCookieNameForRole(role)]
    : CBE_SESSION_COOKIES;
  for (const cookieName of cookieNames) {
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
    });
  }
  return response;
}
