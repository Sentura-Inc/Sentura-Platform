import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";
import { GradSaleAdminClient, type FetchLike } from "./client.js";
import { TOOLS, getTool, listTools } from "./tools.js";
import type { GradSaleAdminConfig } from "./config.js";

const baseConfig: GradSaleAdminConfig = {
  apiBaseUrl: "https://api.gradsale.test",
  adminToken: "test-admin-token",
  requestTimeoutMs: 5_000,
  readOnly: false,
};

function makeFetch(
  expect: {
    url: string;
    method: string;
    body?: unknown;
  },
  response: unknown,
  status = 200,
): FetchLike {
  return vi.fn(async (url, init) => {
    // Assertion is intentional — fail tests when they call the wrong thing.
    if (url !== `${baseConfig.apiBaseUrl}${expect.url}`) {
      throw new Error(`URL mismatch: got ${url}, expected ${baseConfig.apiBaseUrl}${expect.url}`);
    }
    if ((init?.method ?? "GET") !== expect.method) {
      throw new Error(`Method mismatch: got ${init?.method}, expected ${expect.method}`);
    }
    if (expect.body !== undefined) {
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      // Deep-equal via JSON stringification
      if (JSON.stringify(body) !== JSON.stringify(expect.body)) {
        throw new Error(
          `Body mismatch: got ${JSON.stringify(body)}, expected ${JSON.stringify(expect.body)}`,
        );
      }
    }
    return new Response(JSON.stringify(response), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
}

describe("GradSale admin tool registry", () => {
  it("has unique tool names, all prefixed with gradsale_admin_", () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n).toMatch(/^gradsale_admin_/);
  });

  it("covers all 29 GradSale admin endpoints documented in ekg/api-admin.md", () => {
    expect(TOOLS.length).toBe(29);
  });

  it("every tool has an endpoint reference back to api-admin.md", () => {
    for (const tool of TOOLS) {
      expect(tool.endpoint).toMatch(/^(GET|POST|PATCH|PUT|DELETE) \/api\//);
    }
  });

  it("readOnly mode strips mutating tools", () => {
    const all = listTools();
    const ro = listTools({ readOnly: true });
    expect(ro.length).toBeLessThan(all.length);
    expect(ro.every((t) => !t.mutates)).toBe(true);
    // Sanity: read-only excludes disputes handle, support reply, etc.
    expect(ro.find((t) => t.name === "gradsale_admin_handle_dispute")).toBeUndefined();
    expect(ro.find((t) => t.name === "gradsale_admin_list_disputes")).toBeDefined();
  });

  it("input shapes are plain objects (MCP-compatible raw shapes)", () => {
    for (const tool of TOOLS) {
      // every value is a Zod type
      for (const [, schema] of Object.entries(tool.inputShape)) {
        expect(schema).toBeDefined();
        expect(schema instanceof z.ZodType).toBe(true);
      }
    }
  });
});

describe("GradSale admin tool handlers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("list_disputes forwards status filter as query param", async () => {
    const fetchFn = makeFetch(
      { url: "/api/disputes?status=pending", method: "GET" },
      [{ id: "d1" }],
    );
    const client = new GradSaleAdminClient({ config: baseConfig, fetchFn });
    const tool = getTool("gradsale_admin_list_disputes")!;
    const result = await tool.handler(client, { status: "pending" });
    expect(result).toEqual([{ id: "d1" }]);
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("list_disputes with no args hits the unfiltered endpoint", async () => {
    const fetchFn = makeFetch({ url: "/api/disputes", method: "GET" }, []);
    const client = new GradSaleAdminClient({ config: baseConfig, fetchFn });
    const tool = getTool("gradsale_admin_list_disputes")!;
    await tool.handler(client, {});
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("handle_dispute PATCHes with action and notes body", async () => {
    const fetchFn = makeFetch(
      {
        url: "/api/disputes/11111111-1111-1111-1111-111111111111/handle",
        method: "PATCH",
        body: { action: "approved", adminNotes: "Refund issued." },
      },
      { id: "d1", status: "approved" },
    );
    const client = new GradSaleAdminClient({ config: baseConfig, fetchFn });
    const tool = getTool("gradsale_admin_handle_dispute")!;
    const result = await tool.handler(client, {
      disputeId: "11111111-1111-1111-1111-111111111111",
      action: "approved",
      adminNotes: "Refund issued.",
    });
    expect(result).toEqual({ id: "d1", status: "approved" });
  });

  it("review_verification rejects a 'rejected' decision without a reason", async () => {
    const fetchFn = vi.fn();
    const client = new GradSaleAdminClient({ config: baseConfig, fetchFn });
    const tool = getTool("gradsale_admin_review_verification")!;
    await expect(
      tool.handler(client, {
        userId: "22222222-2222-2222-2222-222222222222",
        decision: "rejected",
      }),
    ).rejects.toThrow(/rejectionReason is required/);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("review_verification sends decision + null reason when approving", async () => {
    const fetchFn = makeFetch(
      {
        url: "/api/users/verification/review/22222222-2222-2222-2222-222222222222",
        method: "POST",
        body: { decision: "verified", rejectionReason: null },
      },
      { id: "u1", isVerified: true },
    );
    const client = new GradSaleAdminClient({ config: baseConfig, fetchFn });
    const tool = getTool("gradsale_admin_review_verification")!;
    const result = await tool.handler(client, {
      userId: "22222222-2222-2222-2222-222222222222",
      decision: "verified",
    });
    expect(result).toEqual({ id: "u1", isVerified: true });
  });

  it("list_transactions composes multi-field query string", async () => {
    const fetchFn = makeFetch(
      { url: "/api/transactions?status=completed&search=MacBook&page=2&limit=20", method: "GET" },
      { transactions: [], total: 0, page: 2, limit: 20 },
    );
    const client = new GradSaleAdminClient({ config: baseConfig, fetchFn });
    const tool = getTool("gradsale_admin_list_transactions")!;
    await tool.handler(client, { status: "completed", search: "MacBook", page: 2, limit: 20 });
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("send_support_reply posts body to the correct thread", async () => {
    const threadId = "33333333-3333-3333-3333-333333333333";
    const fetchFn = makeFetch(
      {
        url: `/api/support/admin/threads/${threadId}/messages`,
        method: "POST",
        body: { body: "Hi, we fixed your issue." },
      },
      { id: "msg1" },
    );
    const client = new GradSaleAdminClient({ config: baseConfig, fetchFn });
    const tool = getTool("gradsale_admin_send_support_reply")!;
    await tool.handler(client, { threadId, body: "Hi, we fixed your issue." });
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("client surfaces non-2xx errors with status and body", async () => {
    const fetchFn: FetchLike = vi.fn(async () =>
      new Response(JSON.stringify({ statusCode: 401, message: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new GradSaleAdminClient({ config: baseConfig, fetchFn });
    const tool = getTool("gradsale_admin_list_reports")!;
    await expect(tool.handler(client, {})).rejects.toMatchObject({
      status: 401,
      body: expect.objectContaining({ statusCode: 401 }),
    });
  });

  it("client attaches Authorization header when a token is present", async () => {
    let captured: RequestInit | undefined;
    const fetchFn: FetchLike = vi.fn(async (_url, init) => {
      captured = init;
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    });
    const client = new GradSaleAdminClient({ config: baseConfig, fetchFn });
    await getTool("gradsale_admin_list_reports")!.handler(client, {});
    const headers = captured?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-admin-token");
  });
});
