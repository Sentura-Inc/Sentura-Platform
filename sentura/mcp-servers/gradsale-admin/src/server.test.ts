import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./index.js";
import type { FetchLike } from "./client.js";

/**
 * End-to-end test: simulate an AI employee (MCP client) calling the GradSale
 * admin MCP server over an in-memory transport. This is the "Dispute Resolver
 * employee uses the list_disputes tool" scenario from TeamPlan Week 2.
 *
 * The GradSale backend itself is mocked via a fetchFn stub so the test is
 * hermetic and does not require ekg/ services to be running.
 */

describe("GradSale admin MCP server — end-to-end with MCP client", () => {
  afterEach(() => vi.restoreAllMocks());

  async function connect(fetchFn: FetchLike) {
    const { server } = await createServer({
      config: {
        apiBaseUrl: "http://localhost:3001",
        adminToken: "test-admin-token",
        readOnly: false,
      },
      fetchFn,
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client(
      { name: "sentura-test-employee", version: "0.0.0-test" },
      { capabilities: {} },
    );
    await client.connect(clientTransport);
    return { client, server };
  }

  it("exposes the full GradSale admin tool catalog", async () => {
    const fetchFn: FetchLike = vi.fn();
    const { client } = await connect(fetchFn);

    const { tools } = await client.listTools();
    expect(tools.length).toBe(29);
    const names = tools.map((t) => t.name);
    expect(names).toContain("gradsale_admin_list_disputes");
    expect(names).toContain("gradsale_admin_handle_dispute");
    expect(names).toContain("gradsale_admin_review_verification");

    // Annotations: read-only tools should be marked as such for the agent
    const listDisputes = tools.find((t) => t.name === "gradsale_admin_list_disputes");
    const handleDispute = tools.find((t) => t.name === "gradsale_admin_handle_dispute");
    expect(listDisputes?.annotations?.readOnlyHint).toBe(true);
    expect(handleDispute?.annotations?.destructiveHint).toBe(true);
  });

  it("simulated Dispute Resolver employee: list pending disputes → fetch one → approve it", async () => {
    const disputeId = "11111111-1111-1111-1111-111111111111";
    const fetchFn: FetchLike = vi.fn(async (url, init) => {
      const u = url as string;
      const method = init?.method ?? "GET";

      if (method === "GET" && u.endsWith("/api/disputes?status=pending")) {
        return new Response(JSON.stringify([{ id: disputeId, status: "pending" }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (method === "GET" && u.endsWith(`/api/disputes/${disputeId}`)) {
        return new Response(
          JSON.stringify({
            id: disputeId,
            status: "pending",
            reason: "Item not as described",
            buyer: { id: "b1", username: "buyer" },
            seller: { id: "s1", username: "seller" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (method === "PATCH" && u.endsWith(`/api/disputes/${disputeId}/handle`)) {
        return new Response(
          JSON.stringify({ id: disputeId, status: "approved" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      throw new Error(`Unexpected call: ${method} ${u}`);
    });
    const { client } = await connect(fetchFn);

    const listResult = await client.callTool({
      name: "gradsale_admin_list_disputes",
      arguments: { status: "pending" },
    });
    expect(listResult.isError).toBeFalsy();
    const listText = (listResult.content as Array<{ type: string; text: string }>)[0].text;
    expect(JSON.parse(listText)).toEqual([{ id: disputeId, status: "pending" }]);

    const getResult = await client.callTool({
      name: "gradsale_admin_get_dispute",
      arguments: { disputeId },
    });
    expect(getResult.isError).toBeFalsy();

    const handleResult = await client.callTool({
      name: "gradsale_admin_handle_dispute",
      arguments: {
        disputeId,
        action: "approved",
        adminNotes: "Refund issued — item was clearly misrepresented.",
      },
    });
    expect(handleResult.isError).toBeFalsy();
    const handleText = (handleResult.content as Array<{ type: string; text: string }>)[0].text;
    expect(JSON.parse(handleText)).toEqual({ id: disputeId, status: "approved" });

    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("returns isError when the underlying API returns 4xx", async () => {
    const fetchFn: FetchLike = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ statusCode: 404, message: "Dispute not found" }),
          { status: 404, headers: { "content-type": "application/json" } },
        ),
    );
    const { client } = await connect(fetchFn);

    const result = await client.callTool({
      name: "gradsale_admin_get_dispute",
      arguments: { disputeId: "22222222-2222-2222-2222-222222222222" },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toMatch(/GradSale API 404/);
  });

  it("rejects malformed tool input via MCP validation layer", async () => {
    const fetchFn: FetchLike = vi.fn();
    const { client } = await connect(fetchFn);

    // `disputeId` is required to be a UUID; pass an obviously-bad value.
    // The SDK validates before invoking our handler and returns isError=true.
    const result = await client.callTool({
      name: "gradsale_admin_get_dispute",
      arguments: { disputeId: "not-a-uuid" },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toMatch(/Invalid uuid/);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
