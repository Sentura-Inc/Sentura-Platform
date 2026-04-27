import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./index.js";
import type { FetchLike } from "./client.js";

/**
 * End-to-end test: simulate an AI employee (MCP client) calling the GradSale
 * web MCP server over an in-memory transport. The "Buyer Concierge agent
 * browses listings → opens a thread → sends a message" scenario.
 *
 * The GradSale backend is mocked via a fetchFn stub so the test is hermetic
 * and does not require ekg/ services to be running.
 */

describe("GradSale web MCP server — end-to-end with MCP client", () => {
  afterEach(() => vi.restoreAllMocks());

  async function connect(fetchFn: FetchLike) {
    const { server } = await createServer({
      config: {
        apiBaseUrl: "http://localhost:3001",
        userToken: "test-user-token",
        readOnly: false,
      },
      fetchFn,
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client(
      { name: "sentura-test-buyer-employee", version: "0.0.0-test" },
      { capabilities: {} },
    );
    await client.connect(clientTransport);
    return { client, server };
  }

  it("exposes the full GradSale web tool catalog (32 tools across auth/listings/messages)", async () => {
    const fetchFn: FetchLike = vi.fn();
    const { client } = await connect(fetchFn);

    const { tools } = await client.listTools();
    expect(tools.length).toBe(32);
    const names = tools.map((t) => t.name);
    expect(names).toContain("gradsale_web_register");
    expect(names).toContain("gradsale_web_list_listings");
    expect(names).toContain("gradsale_web_send_message");

    // Annotations: read-only tools should be marked as such for the agent.
    const listListings = tools.find((t) => t.name === "gradsale_web_list_listings");
    const sendMessage = tools.find((t) => t.name === "gradsale_web_send_message");
    expect(listListings?.annotations?.readOnlyHint).toBe(true);
    expect(sendMessage?.annotations?.destructiveHint).toBe(true);
  });

  it("simulated Buyer Concierge: search listings → open a thread → send a follow-up", async () => {
    const listingId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const sellerId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const threadId = "cccccccc-cccc-cccc-cccc-cccccccccccc";

    const fetchFn: FetchLike = vi.fn(async (url, init) => {
      const u = url as string;
      const method = init?.method ?? "GET";

      if (method === "GET" && u.includes("/api/listings/search?q=MacBook")) {
        return new Response(
          JSON.stringify({
            listings: [
              {
                id: listingId,
                title: "MacBook Pro 2021",
                price: "899.99",
                user: { id: sellerId, username: "seller" },
              },
            ],
            total: 1,
            page: 1,
            limit: 20,
            totalPages: 1,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (method === "POST" && u.endsWith("/api/messages/threads")) {
        return new Response(
          JSON.stringify({
            id: threadId,
            participants: [{ userId: sellerId }],
            messages: [{ id: "m1", body: "Hi, is this still available?" }],
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      }
      if (method === "POST" && u.endsWith(`/api/messages/threads/${threadId}/messages`)) {
        return new Response(
          JSON.stringify({ id: "m2", body: "Could you do $750?", threadId }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      }
      throw new Error(`Unexpected call: ${method} ${u}`);
    });

    const { client } = await connect(fetchFn);

    const searchResult = await client.callTool({
      name: "gradsale_web_search_listings",
      arguments: { q: "MacBook" },
    });
    expect(searchResult.isError).toBeFalsy();
    const searchText = (searchResult.content as Array<{ type: string; text: string }>)[0].text;
    expect(JSON.parse(searchText).listings[0].id).toBe(listingId);

    const threadResult = await client.callTool({
      name: "gradsale_web_create_thread",
      arguments: {
        recipientId: sellerId,
        body: "Hi, is this still available?",
        listingId,
      },
    });
    expect(threadResult.isError).toBeFalsy();
    const threadText = (threadResult.content as Array<{ type: string; text: string }>)[0].text;
    expect(JSON.parse(threadText).id).toBe(threadId);

    const followupResult = await client.callTool({
      name: "gradsale_web_send_message",
      arguments: { threadId, body: "Could you do $750?" },
    });
    expect(followupResult.isError).toBeFalsy();

    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("returns isError when the underlying API returns 4xx", async () => {
    const fetchFn: FetchLike = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ statusCode: 404, message: "Listing not found" }),
          { status: 404, headers: { "content-type": "application/json" } },
        ),
    );
    const { client } = await connect(fetchFn);

    const result = await client.callTool({
      name: "gradsale_web_get_listing",
      arguments: { listingId: "11111111-1111-1111-1111-111111111111" },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toMatch(/GradSale API 404/);
  });

  it("rejects malformed tool input via the MCP SDK validation layer", async () => {
    const fetchFn: FetchLike = vi.fn();
    const { client } = await connect(fetchFn);

    // listingId must be a UUID; pass an obviously-bad value.
    const result = await client.callTool({
      name: "gradsale_web_get_listing",
      arguments: { listingId: "not-a-uuid" },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toMatch(/Invalid uuid/);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
