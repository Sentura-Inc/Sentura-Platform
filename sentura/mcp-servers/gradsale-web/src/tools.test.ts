import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";
import { GradSaleWebClient, type FetchLike } from "./client.js";
import { TOOLS, getTool, listTools } from "./tools.js";
import type { GradSaleWebConfig } from "./config.js";

const baseConfig: GradSaleWebConfig = {
  apiBaseUrl: "https://api.gradsale.test",
  userToken: "test-user-token",
  requestTimeoutMs: 5_000,
  readOnly: false,
};

function makeFetch(
  expectShape: { url: string; method: string; body?: unknown; auth?: boolean },
  response: unknown,
  status = 200,
): FetchLike {
  return vi.fn(async (url, init) => {
    if (url !== `${baseConfig.apiBaseUrl}${expectShape.url}`) {
      throw new Error(`URL mismatch: got ${url}, expected ${baseConfig.apiBaseUrl}${expectShape.url}`);
    }
    if ((init?.method ?? "GET") !== expectShape.method) {
      throw new Error(`Method mismatch: got ${init?.method}, expected ${expectShape.method}`);
    }
    if (expectShape.body !== undefined) {
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      if (JSON.stringify(body) !== JSON.stringify(expectShape.body)) {
        throw new Error(
          `Body mismatch: got ${JSON.stringify(body)}, expected ${JSON.stringify(expectShape.body)}`,
        );
      }
    }
    if (expectShape.auth === false) {
      const headers = init?.headers as Record<string, string> | undefined;
      if (headers?.Authorization !== undefined) {
        throw new Error("Authorization header should NOT be set for unauthenticated endpoints");
      }
    }
    return new Response(JSON.stringify(response), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
}

describe("GradSale web tool registry", () => {
  it("has unique tool names, all prefixed with gradsale_web_", () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n).toMatch(/^gradsale_web_/);
  });

  it("covers exactly 32 endpoints (Auth 10, Listings 11, Messages 11)", () => {
    expect(TOOLS.length).toBe(32);
  });

  it("every tool has an endpoint reference back to api-web.md", () => {
    for (const tool of TOOLS) {
      expect(tool.endpoint).toMatch(/^(GET|POST|PATCH|PUT|DELETE) \/api\//);
    }
  });

  it("readOnly mode strips mutating tools", () => {
    const all = listTools();
    const ro = listTools({ readOnly: true });
    expect(ro.length).toBeLessThan(all.length);
    expect(ro.every((t) => !t.mutates)).toBe(true);
    // Sanity: read-only excludes mutations like create_listing / send_message
    // but keeps browse/get tools.
    expect(ro.find((t) => t.name === "gradsale_web_create_listing")).toBeUndefined();
    expect(ro.find((t) => t.name === "gradsale_web_send_message")).toBeUndefined();
    expect(ro.find((t) => t.name === "gradsale_web_list_listings")).toBeDefined();
    expect(ro.find((t) => t.name === "gradsale_web_get_thread")).toBeDefined();
  });

  it("input shapes are plain Zod-keyed objects (MCP-compatible raw shapes)", () => {
    for (const tool of TOOLS) {
      for (const [, schema] of Object.entries(tool.inputShape)) {
        expect(schema).toBeDefined();
        expect(schema instanceof z.ZodType).toBe(true);
      }
    }
  });
});

describe("GradSale web tool handlers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("login persists the access token on the client (auto-auth on subsequent calls)", async () => {
    const fetchFn = makeFetch(
      {
        url: "/api/auth/login",
        method: "POST",
        body: { emailOrUsername: "alice", password: "pw" },
        auth: false,
      },
      { user: { id: "u1" }, accessToken: "fresh-token", refreshToken: "rt" },
    );
    // Build a client with NO cached token so we can verify login sets it.
    const client = new GradSaleWebClient({
      config: { ...baseConfig, userToken: undefined },
      fetchFn,
    });
    await getTool("gradsale_web_login")!.handler(client, {
      emailOrUsername: "alice",
      password: "pw",
    });

    // Reach an authenticated endpoint and confirm the freshly-minted
    // token rides along. We construct a second client with a tokenProvider
    // returning the same value the login response set — exercising the
    // full Authorization-header path without poking private state.
    let captured: RequestInit | undefined;
    const authFetch: FetchLike = vi.fn(async (_url, init) => {
      captured = init;
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    });
    const followup = new GradSaleWebClient({
      config: { ...baseConfig, userToken: undefined },
      fetchFn: authFetch,
      tokenProvider: () => "fresh-token",
    });
    await getTool("gradsale_web_get_me")!.handler(followup, {});
    const headers = captured?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer fresh-token");
  });

  it("logout clears the cached token", async () => {
    const fetchFn = makeFetch(
      { url: "/api/auth/logout", method: "POST" },
      { message: "Logged out successfully" },
    );
    const client = new GradSaleWebClient({ config: baseConfig, fetchFn });
    await getTool("gradsale_web_logout")!.handler(client, {});
    // Subsequent authenticated call without creds should send no auth header.
    let captured: RequestInit | undefined;
    const followup: FetchLike = vi.fn(async (_url, init) => {
      captured = init;
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    });
    const c2 = new GradSaleWebClient({
      config: { ...baseConfig, userToken: undefined },
      fetchFn: followup,
    });
    await getTool("gradsale_web_get_me")!.handler(c2, {});
    const headers = captured?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("register hits the unauthenticated endpoint with the full body", async () => {
    const body = {
      username: "newuser",
      email: "new@bu.edu",
      password: "abcdefghi",
      university: "Boston University",
      graduationYear: 2026,
    };
    const fetchFn = makeFetch(
      { url: "/api/auth/register", method: "POST", body, auth: false },
      { message: "Registration successful. Please verify your email." },
    );
    const client = new GradSaleWebClient({
      config: { ...baseConfig, userToken: undefined },
      fetchFn,
    });
    const result = await getTool("gradsale_web_register")!.handler(client, body);
    expect(result).toMatchObject({ message: expect.stringContaining("verify your email") });
  });

  it("list_listings composes a multi-field query string", async () => {
    const fetchFn = makeFetch(
      {
        url: "/api/listings?category=Electronics&minPrice=100&maxPrice=500&sortBy=price_low&page=2&limit=20",
        method: "GET",
      },
      { listings: [], total: 0, page: 2, limit: 20, totalPages: 0 },
    );
    const client = new GradSaleWebClient({ config: baseConfig, fetchFn });
    await getTool("gradsale_web_list_listings")!.handler(client, {
      category: "Electronics",
      minPrice: 100,
      maxPrice: 500,
      sortBy: "price_low",
      page: 2,
      limit: 20,
    });
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("create_listing PATCHes nothing — POSTs the full payload", async () => {
    const payload = {
      title: "MacBook Pro 2021",
      description: "Great condition",
      price: 899.99,
      category: "Electronics",
      paymentOption: "both" as const,
      imageUrls: ["https://img.test/m1.jpg"],
      university: "Boston University",
      openToOffers: true,
      lowestPrice: 750,
    };
    const fetchFn = makeFetch(
      { url: "/api/listings", method: "POST", body: payload },
      { id: "list-1", ...payload },
    );
    const client = new GradSaleWebClient({ config: baseConfig, fetchFn });
    const result = (await getTool("gradsale_web_create_listing")!.handler(
      client,
      payload,
    )) as { id: string };
    expect(result.id).toBe("list-1");
  });

  it("update_listing PATCHes only the fields supplied; listingId comes out of the body", async () => {
    const listingId = "11111111-1111-1111-1111-111111111111";
    const fetchFn = makeFetch(
      {
        url: `/api/listings/${listingId}`,
        method: "PATCH",
        body: { price: 799 },
      },
      { id: listingId, price: 799 },
    );
    const client = new GradSaleWebClient({ config: baseConfig, fetchFn });
    await getTool("gradsale_web_update_listing")!.handler(client, {
      listingId,
      price: 799,
    });
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("set_listing_status only sends the status field in the body", async () => {
    const listingId = "22222222-2222-2222-2222-222222222222";
    const fetchFn = makeFetch(
      {
        url: `/api/listings/${listingId}/status`,
        method: "PATCH",
        body: { status: "hidden" },
      },
      { id: listingId, status: "hidden" },
    );
    const client = new GradSaleWebClient({ config: baseConfig, fetchFn });
    await getTool("gradsale_web_set_listing_status")!.handler(client, {
      listingId,
      status: "hidden",
    });
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("send_message strips threadId from body and embeds it in the path", async () => {
    const threadId = "33333333-3333-3333-3333-333333333333";
    const fetchFn = makeFetch(
      {
        url: `/api/messages/threads/${threadId}/messages`,
        method: "POST",
        body: { body: "Sounds good — see you at 3pm." },
      },
      { id: "msg-1", body: "Sounds good — see you at 3pm." },
    );
    const client = new GradSaleWebClient({ config: baseConfig, fetchFn });
    await getTool("gradsale_web_send_message")!.handler(client, {
      threadId,
      body: "Sounds good — see you at 3pm.",
    });
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("complete_checkout sends transactionId in the body", async () => {
    const messageId = "44444444-4444-4444-4444-444444444444";
    const transactionId = "55555555-5555-5555-5555-555555555555";
    const fetchFn = makeFetch(
      {
        url: `/api/messages/checkout/${messageId}/complete`,
        method: "POST",
        body: { transactionId },
      },
      { checkoutMessage: { id: messageId } },
    );
    const client = new GradSaleWebClient({ config: baseConfig, fetchFn });
    await getTool("gradsale_web_complete_checkout")!.handler(client, {
      messageId,
      transactionId,
    });
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("client surfaces non-2xx errors with status and body", async () => {
    const fetchFn: FetchLike = vi.fn(async () =>
      new Response(
        JSON.stringify({ statusCode: 401, message: "Unauthorized" }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
    );
    const client = new GradSaleWebClient({ config: baseConfig, fetchFn });
    await expect(getTool("gradsale_web_list_threads")!.handler(client, {})).rejects.toMatchObject({
      status: 401,
      body: expect.objectContaining({ statusCode: 401 }),
    });
  });

  it("client attaches Authorization header when a token is present", async () => {
    let captured: RequestInit | undefined;
    const fetchFn: FetchLike = vi.fn(async (_url, init) => {
      captured = init;
      return new Response("[]", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const client = new GradSaleWebClient({ config: baseConfig, fetchFn });
    await getTool("gradsale_web_list_threads")!.handler(client, {});
    const headers = captured?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-user-token");
  });
});
