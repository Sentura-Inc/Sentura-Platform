/**
 * Server-side API error helper.
 *
 * Wraps internal errors so we don't forward `err.message` (which can leak
 * filesystem paths, OS usernames, gateway internals) to API clients. Each
 * error gets a request id; full detail is logged server-side.
 *
 * Public response shape: `{ error: string, requestId: string }` — the `error`
 * is a stable, human-readable label; `requestId` is the correlation key for
 * the operator looking in server logs.
 */
import { NextResponse } from "next/server";

let _seq = 0;

function nextRequestId(): string {
  _seq += 1;
  // Compact, non-cryptographic id; collisions across processes are fine.
  return `req_${Date.now().toString(36)}_${_seq.toString(36)}`;
}

/**
 * Build a NextResponse for an internal failure. The caller's intent is
 * captured in `publicMessage`; the underlying error is logged with the same
 * requestId so support can correlate.
 */
export function internalErrorResponse(
  publicMessage: string,
  detail: unknown,
  status = 500,
): NextResponse {
  const requestId = nextRequestId();
  const detailString =
    detail instanceof Error
      ? `${detail.name}: ${detail.message}`
      : typeof detail === "string"
        ? detail
        : JSON.stringify(detail);
  // eslint-disable-next-line no-console
  console.error(`[api] ${requestId} ${publicMessage} :: ${detailString}`);
  return NextResponse.json(
    { error: publicMessage, requestId },
    { status },
  );
}

/**
 * 4xx response with a stable label. Use for validation failures, not
 * unexpected errors. No log line — these are user-input issues, not
 * operator-actionable.
 */
export function badRequestResponse(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
