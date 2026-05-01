import { describe, expect, it, vi } from "vitest";
import {
  GradSaleSearchClient,
  GradSaleSearchError,
  createServer,
  listTools,
  loadConfigFromEnv,
} from "./index.js";

describe("loadConfigFromEnv", () => {
  it("uses defaults when env is empty", () => {
    const cfg = loadConfigFromEnv({});
    expect(cfg.apiBaseUrl).toBe("http://localhost:3001");
    expect(cfg.requestTimeoutMs).toBe(30_000);
    expect(cfg.userToken).toBeUndefined();
  });

  it("respects GRADSALE_API_URL and GRADSALE_USER_TOKEN", () => {
    const cfg = loadConfigFromEnv({
      GRADSALE_API_URL: "https://api.gradsale.test",
      GRADSALE_USER_TOKEN: "tok_xyz",
      GRADSALE_REQUEST_TIMEOUT_MS: "5000",
    });
    expect(cfg.apiBaseUrl).toBe("https://api.gradsale.test");
    expect(cfg.userToken).toBe("tok_xyz");
    expect(cfg.requestTimeoutMs).toBe(5_000);
  });

  it("rejects malformed apiBaseUrl", () => {
    expect(() => loadConfigFromEnv({ GRADSALE_API_URL: "not-a-url" })).toThrow();
  });
});

describe("listTools — Tier 2 surface", () => {
  it("registers exactly the expected read-only tools", () => {
    const names = listTools().map((t) => t.name);
    expect(names).toEqual([
      "gradsale_search_get_public_profile",
      "gradsale_search_get_user_ratings",
      "gradsale_search_get_user_transaction_stats",
      "gradsale_search_get_user_verification_status",
      "gradsale_search_list_universities",
      "gradsale_search_geocode_address",
      "gradsale_search_reverse_geocode",
      "gradsale_search_users",
    ]);
  });

  it("every tool is sourced from ekg/api-web.md", () => {
    for (const tool of listTools()) {
      expect(tool.source).toMatch(/^ekg\/api-web\.md/);
    }
  });
});

describe("GradSaleSearchClient — HTTP wiring", () => {
  function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  it("sends Authorization header when userToken is set", async () => {
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string>).Authorization;
      expect(auth).toBe("Bearer tok_test");
      return jsonResponse(200, { ok: true });
    });
    const client = new GradSaleSearchClient(
      {
        apiBaseUrl: "https://api.example.com",
        userToken: "tok_test",
        requestTimeoutMs: 1000,
      },
      fetchFn as never,
    );
    await client.getJson("/api/users/abc");
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("omits Authorization when userToken is unset", async () => {
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string>).Authorization;
      expect(auth).toBeUndefined();
      return jsonResponse(200, []);
    });
    const client = new GradSaleSearchClient(
      { apiBaseUrl: "https://api.example.com", requestTimeoutMs: 1000 },
      fetchFn as never,
    );
    await client.getJson("/api/universities");
  });

  it("throws GradSaleSearchError on non-2xx", async () => {
    const fetchFn = vi.fn(async () => jsonResponse(404, { message: "not found" }));
    const client = new GradSaleSearchClient(
      { apiBaseUrl: "https://api.example.com", requestTimeoutMs: 1000 },
      fetchFn as never,
    );
    await expect(client.getJson("/api/users/missing")).rejects.toBeInstanceOf(
      GradSaleSearchError,
    );
  });

  it("URL-encodes path parameters", async () => {
    const fetchFn = vi.fn(async (url: string) => {
      expect(url).toBe(
        "https://api.example.com/api/users/00000000-0000-0000-0000-000000000001",
      );
      return jsonResponse(200, {});
    });
    const tool = listTools().find((t) => t.name === "gradsale_search_get_public_profile")!;
    const client = new GradSaleSearchClient(
      { apiBaseUrl: "https://api.example.com", requestTimeoutMs: 1000 },
      fetchFn as never,
    );
    await tool.handler(client, { userId: "00000000-0000-0000-0000-000000000001" });
  });

  it("encodes geocode reverse query as lat/lon", async () => {
    const fetchFn = vi.fn(async (url: string) => {
      expect(url).toBe("https://api.example.com/api/geocoding/reverse?lat=42.35&lon=-71.1");
      return jsonResponse(200, { address: "Boston, MA" });
    });
    const tool = listTools().find((t) => t.name === "gradsale_search_reverse_geocode")!;
    const client = new GradSaleSearchClient(
      { apiBaseUrl: "https://api.example.com", requestTimeoutMs: 1000 },
      fetchFn as never,
    );
    await tool.handler(client, { latitude: 42.35, longitude: -71.1 });
  });
});

describe("createServer — MCP wiring", () => {
  it("registers every tool without throwing", async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const { server, config } = await createServer({
      config: { apiBaseUrl: "https://api.example.com", requestTimeoutMs: 1000 },
      fetchFn: fetchFn as never,
    });
    expect(config.apiBaseUrl).toBe("https://api.example.com");
    expect(server).toBeDefined();
  });
});
