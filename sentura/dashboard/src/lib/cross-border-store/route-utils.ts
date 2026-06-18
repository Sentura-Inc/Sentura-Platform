import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { CbeStoreError } from "./errors";

export function cbeJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function parseJsonRequest<T>(request: Request, schema: ZodType<T>) {
  const body = await readJsonRequest(request);
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new CbeStoreError(400, "validation_failed", "Request body failed validation.", result.error.flatten());
  }
  return result.data;
}

export async function readJsonRequest(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new CbeStoreError(400, "invalid_json", "Request body must be valid JSON.");
  }
}

export function parseListQuery<T>(request: Request, schema: ZodType<T>) {
  const url = new URL(request.url);
  const data = Object.fromEntries(url.searchParams.entries());
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new CbeStoreError(400, "query_validation_failed", "Query parameters failed validation.", result.error.flatten());
  }
  return result.data;
}

export function cbeRouteError(error: unknown) {
  if (error instanceof CbeStoreError) {
    return cbeJson(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      error.status,
    );
  }
  if (error instanceof ZodError) {
    return cbeJson(
      {
        error: {
          code: "validation_failed",
          message: "Request failed validation.",
          details: error.flatten(),
        },
      },
      400,
    );
  }
  if (error && typeof error === "object" && "message" in error) {
    const record = error as { code?: unknown; message?: unknown; details?: unknown };
    if (typeof record.message === "string" && record.message.trim()) {
      return cbeJson(
        {
          error: {
            code: typeof record.code === "string" ? record.code : "internal_error",
            message: record.message,
            details: record.details,
          },
        },
        500,
      );
    }
  }
  const message = error instanceof Error ? error.message : "Unexpected CBE route error.";
  return cbeJson(
    {
      error: {
        code: "internal_error",
        message,
      },
    },
    500,
  );
}
