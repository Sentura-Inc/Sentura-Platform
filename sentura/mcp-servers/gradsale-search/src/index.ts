#!/usr/bin/env node
/**
 * Sentura GradSale Search — Tier 2 MCP server.
 *
 * Generated from `ekg/api-web.md`:
 * - Section 2 (Users)        — public profile lookups, ratings, transaction stats
 * - Section 9 (Ratings)      — list/search ratings
 * - Section 15 (Universities) — directory of supported universities
 * - Section 17 (Geocoding)   — address ↔ coords lookups
 *
 * The server is intentionally **read-only** — no POST/PATCH/DELETE tools are
 * registered. It complements `gradsale-admin/` (admin write surface) and
 * `gradsale-web/` (auth + listings + messages) by exposing the public
 * discovery surface AI employees use during onboarding, recommendation, and
 * trust-and-safety review.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// -----------------------------------------------------------------
// Config
// -----------------------------------------------------------------
const ConfigSchema = z.object({
  apiBaseUrl: z.string().url(),
  /** Optional bearer token. Public read endpoints work without auth, but the
   *  server attaches the token if set so soft-paywalled fields (e.g. flagged
   *  user records) come through for trust personas. */
  userToken: z.string().min(1).optional(),
  requestTimeoutMs: z.number().int().positive().default(30_000),
});

export type GradSaleSearchConfig = z.infer<typeof ConfigSchema>;

export function loadConfigFromEnv(env: NodeJS.ProcessEnv = process.env): GradSaleSearchConfig {
  return ConfigSchema.parse({
    apiBaseUrl: env.GRADSALE_API_URL ?? "http://localhost:3001",
    userToken: env.GRADSALE_USER_TOKEN,
    requestTimeoutMs: env.GRADSALE_REQUEST_TIMEOUT_MS
      ? Number(env.GRADSALE_REQUEST_TIMEOUT_MS)
      : undefined,
  });
}

// -----------------------------------------------------------------
// HTTP client
// -----------------------------------------------------------------
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class GradSaleSearchError extends Error {
  constructor(message: string, public readonly status: number, public readonly body: unknown) {
    super(message);
    this.name = "GradSaleSearchError";
  }
}

export class GradSaleSearchClient {
  private readonly fetchFn: FetchLike;
  constructor(
    private readonly config: GradSaleSearchConfig,
    fetchFn?: FetchLike,
  ) {
    this.fetchFn = fetchFn ?? (globalThis.fetch as FetchLike);
  }

  async getJson<T = unknown>(pathAndQuery: string): Promise<T> {
    const url = `${this.config.apiBaseUrl}${pathAndQuery}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.config.userToken) headers.Authorization = `Bearer ${this.config.userToken}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.config.requestTimeoutMs);
    try {
      const res = await this.fetchFn(url, { method: "GET", headers, signal: ctrl.signal });
      const ct = res.headers.get("content-type") ?? "";
      const payload = ct.includes("application/json") ? await res.json() : await res.text();
      if (!res.ok) {
        throw new GradSaleSearchError(
          `GradSale request failed: ${res.status} ${res.statusText}`,
          res.status,
          payload,
        );
      }
      return payload as T;
    } finally {
      clearTimeout(timer);
    }
  }
}

// -----------------------------------------------------------------
// Tool definitions
// -----------------------------------------------------------------
export interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputShape: Record<string, z.ZodTypeAny>;
  endpoint: string;
  source: string;
  handler: (client: GradSaleSearchClient, args: Record<string, unknown>) => Promise<unknown>;
}

export function listTools(): ToolDef[] {
  return [
    // ---------- Section 2 — Users (public) ----------
    {
      name: "gradsale_search_get_public_profile",
      title: "Get public user profile",
      description:
        "Look up a user's public-facing profile (display name, university, verification status, profile picture). Read-only.",
      inputShape: { userId: z.string().min(1).describe("Public user UUID") },
      endpoint: "GET /api/users/:id",
      source: "ekg/api-web.md § 2",
      handler: async (client, args) =>
        client.getJson(`/api/users/${encodeURIComponent(String(args.userId))}`),
    },
    {
      name: "gradsale_search_get_user_ratings",
      title: "Get a user's ratings",
      description:
        "Return the ratings other users have left on this user (counterparty trust signal). Read-only.",
      inputShape: { userId: z.string().min(1).describe("Public user UUID") },
      endpoint: "GET /api/users/:id/ratings",
      source: "ekg/api-web.md § 2 / § 9",
      handler: async (client, args) =>
        client.getJson(`/api/users/${encodeURIComponent(String(args.userId))}/ratings`),
    },
    {
      name: "gradsale_search_get_user_transaction_stats",
      title: "Get a user's transaction stats",
      description:
        "Return transaction-volume aggregates for a user (total transactions, completion rate, last-active timestamp). Read-only.",
      inputShape: { userId: z.string().min(1).describe("Public user UUID") },
      endpoint: "GET /api/users/:id/transaction-stats",
      source: "ekg/api-web.md § 2",
      handler: async (client, args) =>
        client.getJson(
          `/api/users/${encodeURIComponent(String(args.userId))}/transaction-stats`,
        ),
    },
    {
      name: "gradsale_search_get_user_verification_status",
      title: "Get current user's verification status",
      description:
        "Return whether the authenticated user has completed identity verification. Requires GRADSALE_USER_TOKEN. Read-only — verification submission lives on the web/admin servers.",
      inputShape: {},
      endpoint: "GET /api/users/verification/status",
      source: "ekg/api-web.md § 2",
      handler: async (client) => client.getJson("/api/users/verification/status"),
    },

    // ---------- Section 15 — Universities ----------
    {
      name: "gradsale_search_list_universities",
      title: "List supported universities",
      description:
        "Return the directory of universities the GradSale platform supports. Useful during onboarding to validate a user's chosen institution.",
      inputShape: {
        query: z
          .string()
          .optional()
          .describe(
            "Optional substring to filter the directory (case-insensitive). When omitted, returns the full list.",
          ),
      },
      endpoint: "GET /api/universities",
      source: "ekg/api-web.md § 15",
      handler: async (client, args) => {
        const q = typeof args.query === "string" ? args.query : "";
        const qs = q ? `?q=${encodeURIComponent(q)}` : "";
        return client.getJson(`/api/universities${qs}`);
      },
    },

    // ---------- Section 17 — Geocoding ----------
    {
      name: "gradsale_search_geocode_address",
      title: "Geocode address → coordinates",
      description:
        "Convert a free-text address (e.g. 'Boston University, MA') into latitude/longitude. Used by the recommender to surface listings near a user.",
      inputShape: {
        address: z.string().min(2).describe("Free-text address to geocode"),
      },
      endpoint: "GET /api/geocoding/address",
      source: "ekg/api-web.md § 17",
      handler: async (client, args) =>
        client.getJson(`/api/geocoding/address?q=${encodeURIComponent(String(args.address))}`),
    },
    {
      name: "gradsale_search_reverse_geocode",
      title: "Reverse geocode coordinates → address",
      description:
        "Convert latitude/longitude into a human-readable address. Used by trust-and-safety to verify a meetup location is on a public campus.",
      inputShape: {
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      },
      endpoint: "GET /api/geocoding/reverse",
      source: "ekg/api-web.md § 17",
      handler: async (client, args) =>
        client.getJson(
          `/api/geocoding/reverse?lat=${Number(args.latitude)}&lon=${Number(args.longitude)}`,
        ),
    },

    // ---------- Aggregator ----------
    {
      name: "gradsale_search_users",
      title: "Free-text user directory search",
      description:
        "Substring search across the public user directory (display name, username, university). Read-only.",
      inputShape: {
        query: z.string().min(1).describe("Free-text search query (case-insensitive substring match)"),
        limit: z.number().int().min(1).max(100).default(20).describe("Max rows to return (1-100)"),
      },
      endpoint: "GET /api/users/search",
      source: "ekg/api-web.md § 2 (derived)",
      handler: async (client, args) => {
        const limit = typeof args.limit === "number" ? args.limit : 20;
        return client.getJson(
          `/api/users/search?q=${encodeURIComponent(String(args.query))}&limit=${limit}`,
        );
      },
    },
  ];
}

// -----------------------------------------------------------------
// MCP server bootstrap
// -----------------------------------------------------------------
export interface CreateServerOptions {
  config?: Partial<GradSaleSearchConfig>;
  fetchFn?: FetchLike;
}

export async function createServer(options: CreateServerOptions = {}) {
  const config: GradSaleSearchConfig = { ...loadConfigFromEnv(), ...options.config };
  const client = new GradSaleSearchClient(config, options.fetchFn);

  const server = new McpServer({
    name: "sentura-gradsale-search",
    version: "0.1.0",
  });

  for (const tool of listTools()) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputShape,
        annotations: {
          // Every tool here is read-only — surface that to the client so it
          // can skip the human-approval gate for benign discovery calls.
          readOnlyHint: true,
          destructiveHint: false,
        },
        _meta: {
          "sentura/endpoint": tool.endpoint,
          "sentura/sourceDoc": tool.source,
        },
      },
      async (args: Record<string, unknown>) => {
        try {
          const result = await tool.handler(client, args);
          return {
            content: [
              {
                type: "text" as const,
                text:
                  typeof result === "string"
                    ? result
                    : JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (err) {
          const message =
            err instanceof GradSaleSearchError
              ? `GradSale ${err.status}: ${err.message}\n${JSON.stringify(err.body, null, 2)}`
              : err instanceof Error
                ? err.message
                : String(err);
          return { isError: true, content: [{ type: "text" as const, text: message }] };
        }
      },
    );
  }

  return { server, client, config };
}

async function main() {
  const { server } = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[sentura-gradsale-search] MCP server started on stdio");
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error("[sentura-gradsale-search] fatal:", err);
    process.exit(1);
  });
}
