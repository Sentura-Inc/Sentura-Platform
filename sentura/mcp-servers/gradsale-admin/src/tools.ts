import { z } from "zod";
import type { GradSaleAdminClient } from "./client.js";

/**
 * GradSale Admin MCP tool registry.
 *
 * Each tool is a thin facade over one endpoint in `ekg/api-admin.md`. Input
 * shapes are plain `Record<string, ZodType>` so they plug directly into the
 * MCP SDK's `server.registerTool(name, { inputSchema }, handler)` API.
 *
 * Conventions:
 *   - `tool.endpoint` is the canonical reference back to the API docs.
 *   - `tool.mutates` is true for write operations (filtered out in read-only
 *     mode for auditor personas).
 *   - Tool names use snake_case with a `gradsale_admin_` prefix to avoid
 *     collisions with other MCP servers registered on the same employee.
 */

export type RawShape = Record<string, z.ZodTypeAny>;

export interface ToolDefinition<S extends RawShape = RawShape> {
  name: string;
  title: string;
  description: string;
  endpoint: string;
  mutates: boolean;
  inputShape: S;
  handler: (
    client: GradSaleAdminClient,
    args: { [K in keyof S]: z.infer<S[K]> },
  ) => Promise<unknown>;
}

const paginationShape = {
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(200).optional(),
};

const uuid = () => z.string().uuid();

export const TOOLS: ToolDefinition[] = [
  // ── 1. Admin Authentication ────────────────────────────────────────────────
  {
    name: "gradsale_admin_login",
    title: "GradSale Admin Login",
    description:
      "Authenticate as a GradSale admin and return an access token. Usually not called directly — the MCP server handles login automatically if GRADSALE_ADMIN_EMAIL/PASSWORD are configured. Use this only to verify credentials or capture a fresh token.",
    endpoint: "POST /api/auth/admin/login",
    mutates: false,
    inputShape: {
      email: z.string().email(),
      password: z.string().min(1),
    },
    handler: async (client, args) =>
      client.request("POST", "/api/auth/admin/login", args),
  },

  // ── 2. Disputes ────────────────────────────────────────────────────────────
  {
    name: "gradsale_admin_list_disputes",
    title: "List Disputes",
    description:
      "List buyer disputes across the platform. Filter by status (pending/approved/rejected). Use 'pending' to find the queue that needs admin attention.",
    endpoint: "GET /api/disputes",
    mutates: false,
    inputShape: {
      status: z.enum(["pending", "approved", "rejected"]).optional(),
    },
    handler: async (client, args) => {
      const qs = args.status ? `?status=${encodeURIComponent(args.status)}` : "";
      return client.request("GET", `/api/disputes${qs}`);
    },
  },
  {
    name: "gradsale_admin_get_dispute",
    title: "Get Dispute",
    description:
      "Fetch the full detail of a single dispute (buyer, seller, transaction, listing, and current admin notes). Use before calling handle_dispute.",
    endpoint: "GET /api/disputes/:id",
    mutates: false,
    inputShape: { disputeId: uuid() },
    handler: async (client, { disputeId }) =>
      client.request("GET", `/api/disputes/${encodeURIComponent(disputeId)}`),
  },
  {
    name: "gradsale_admin_handle_dispute",
    title: "Handle Dispute",
    description:
      "Approve (refund the buyer) or reject a dispute and record admin notes. This is a write action that triggers a Stripe refund when approved — requires human approval in Sentura.",
    endpoint: "PATCH /api/disputes/:id/handle",
    mutates: true,
    inputShape: {
      disputeId: uuid(),
      action: z.enum(["approved", "rejected"]),
      adminNotes: z.string().max(2000).optional(),
    },
    handler: async (client, { disputeId, ...body }) =>
      client.request(
        "PATCH",
        `/api/disputes/${encodeURIComponent(disputeId)}/handle`,
        body,
      ),
  },

  // ── 3. User Verification Review ────────────────────────────────────────────
  {
    name: "gradsale_admin_list_pending_verifications",
    title: "List Pending Verifications",
    description:
      "List all users awaiting manual alumni verification review (uploaded IDs + proof docs). Returns the queue for trust-and-safety work.",
    endpoint: "GET /api/users/verification/pending",
    mutates: false,
    inputShape: {},
    handler: async (client) => client.request("GET", "/api/users/verification/pending"),
  },
  {
    name: "gradsale_admin_get_user",
    title: "Get User",
    description:
      "Get a user's full profile, including uploaded verification images. Use to read context before reviewing a verification submission.",
    endpoint: "GET /api/users/:id",
    mutates: false,
    inputShape: { userId: uuid() },
    handler: async (client, { userId }) =>
      client.request("GET", `/api/users/${encodeURIComponent(userId)}`),
  },
  {
    name: "gradsale_admin_review_verification",
    title: "Review Verification",
    description:
      "Approve ('verified') or reject a user's manual alumni verification submission. A rejection requires a human-readable reason. Mutating — should go through Sentura approval.",
    endpoint: "POST /api/users/verification/review/:userId",
    mutates: true,
    inputShape: {
      userId: uuid(),
      decision: z.enum(["verified", "rejected"]),
      rejectionReason: z.string().max(1000).optional(),
    },
    handler: async (client, { userId, decision, rejectionReason }) => {
      if (decision === "rejected" && !rejectionReason) {
        throw new Error("rejectionReason is required when decision is 'rejected'");
      }
      return client.request(
        "POST",
        `/api/users/verification/review/${encodeURIComponent(userId)}`,
        { decision, rejectionReason: rejectionReason ?? null },
      );
    },
  },

  // ── 4. Ratings Oversight (read-only) ──────────────────────────────────────
  {
    name: "gradsale_admin_get_user_ratings",
    title: "Get User Ratings",
    description: "Get a paginated list of ratings left for a specific user.",
    endpoint: "GET /api/ratings/user/:userId",
    mutates: false,
    inputShape: { userId: uuid(), ...paginationShape },
    handler: async (client, { userId, page, limit }) => {
      const qs = new URLSearchParams();
      if (page !== undefined) qs.set("page", String(page));
      if (limit !== undefined) qs.set("limit", String(limit));
      const q = qs.toString() ? `?${qs.toString()}` : "";
      return client.request("GET", `/api/ratings/user/${encodeURIComponent(userId)}${q}`);
    },
  },
  {
    name: "gradsale_admin_get_user_rating_stats",
    title: "Get User Rating Stats",
    description: "Get aggregated rating stats (average, total, 1–5 breakdown) for a user.",
    endpoint: "GET /api/ratings/user/:userId/stats",
    mutates: false,
    inputShape: { userId: uuid() },
    handler: async (client, { userId }) =>
      client.request("GET", `/api/ratings/user/${encodeURIComponent(userId)}/stats`),
  },
  {
    name: "gradsale_admin_get_transaction_ratings",
    title: "Get Transaction Ratings",
    description: "Get both the buyer's and seller's ratings left on a specific transaction.",
    endpoint: "GET /api/ratings/transaction/:transactionId/all",
    mutates: false,
    inputShape: { transactionId: uuid() },
    handler: async (client, { transactionId }) =>
      client.request(
        "GET",
        `/api/ratings/transaction/${encodeURIComponent(transactionId)}/all`,
      ),
  },

  // ── 5. Reports Management ──────────────────────────────────────────────────
  {
    name: "gradsale_admin_list_reports",
    title: "List Reports",
    description:
      "List user-generated reports (on listings, users, or messages). Filter by status and/or report type.",
    endpoint: "GET /api/reports",
    mutates: false,
    inputShape: {
      status: z.enum(["pending", "under_review", "resolved", "dismissed"]).optional(),
      type: z.enum(["listing", "user", "message"]).optional(),
    },
    handler: async (client, args) => {
      const qs = new URLSearchParams();
      if (args.status) qs.set("status", args.status);
      if (args.type) qs.set("type", args.type);
      const q = qs.toString() ? `?${qs.toString()}` : "";
      return client.request("GET", `/api/reports${q}`);
    },
  },
  {
    name: "gradsale_admin_get_report_stats",
    title: "Report Stats",
    description:
      "Get a report overview: totals by status and by type. Useful for daily briefings.",
    endpoint: "GET /api/reports/stats",
    mutates: false,
    inputShape: {},
    handler: async (client) => client.request("GET", "/api/reports/stats"),
  },
  {
    name: "gradsale_admin_get_report",
    title: "Get Report",
    description: "Get the full detail of a single report.",
    endpoint: "GET /api/reports/:id",
    mutates: false,
    inputShape: { reportId: uuid() },
    handler: async (client, { reportId }) =>
      client.request("GET", `/api/reports/${encodeURIComponent(reportId)}`),
  },
  {
    name: "gradsale_admin_update_report",
    title: "Update Report",
    description:
      "Move a report along its workflow (pending → under_review → resolved | dismissed) and optionally attach admin notes.",
    endpoint: "PATCH /api/reports/:id",
    mutates: true,
    inputShape: {
      reportId: uuid(),
      status: z.enum(["pending", "under_review", "resolved", "dismissed"]),
      adminNotes: z.string().max(2000).optional(),
    },
    handler: async (client, { reportId, ...body }) =>
      client.request("PATCH", `/api/reports/${encodeURIComponent(reportId)}`, body),
  },
  {
    name: "gradsale_admin_delete_report",
    title: "Delete Report",
    description:
      "Permanently delete a report. Destructive — human approval required in Sentura.",
    endpoint: "DELETE /api/reports/:id",
    mutates: true,
    inputShape: { reportId: uuid() },
    handler: async (client, { reportId }) =>
      client.request("DELETE", `/api/reports/${encodeURIComponent(reportId)}`),
  },

  // ── 6. Support Threads ─────────────────────────────────────────────────────
  {
    name: "gradsale_admin_list_support_threads",
    title: "List Support Threads",
    description:
      "List all customer support threads, including participants and recent messages. Entry point for a Support Agent persona.",
    endpoint: "GET /api/support/admin/threads",
    mutates: false,
    inputShape: {},
    handler: async (client) => client.request("GET", "/api/support/admin/threads"),
  },
  {
    name: "gradsale_admin_get_support_thread",
    title: "Get Support Thread",
    description:
      "Get the full message history and participants for a single support thread. Always call before replying.",
    endpoint: "GET /api/support/admin/threads/:threadId",
    mutates: false,
    inputShape: { threadId: uuid() },
    handler: async (client, { threadId }) =>
      client.request(
        "GET",
        `/api/support/admin/threads/${encodeURIComponent(threadId)}`,
      ),
  },
  {
    name: "gradsale_admin_update_support_thread_status",
    title: "Update Support Thread Status",
    description:
      "Update a support thread status (open → in_progress → resolved | closed).",
    endpoint: "PATCH /api/support/admin/threads/:threadId/status",
    mutates: true,
    inputShape: {
      threadId: uuid(),
      status: z.enum(["open", "in_progress", "resolved", "closed"]),
    },
    handler: async (client, { threadId, status }) =>
      client.request(
        "PATCH",
        `/api/support/admin/threads/${encodeURIComponent(threadId)}/status`,
        { status },
      ),
  },
  {
    name: "gradsale_admin_send_support_reply",
    title: "Send Support Reply",
    description:
      "Send a reply in a support thread as the admin/system user. User-facing — always go through Sentura's approval for T2+ data.",
    endpoint: "POST /api/support/admin/threads/:threadId/messages",
    mutates: true,
    inputShape: {
      threadId: uuid(),
      body: z.string().min(1).max(8000),
    },
    handler: async (client, { threadId, body }) =>
      client.request(
        "POST",
        `/api/support/admin/threads/${encodeURIComponent(threadId)}/messages`,
        { body },
      ),
  },
  {
    name: "gradsale_admin_support_system_user_exists",
    title: "Support System User Exists",
    description:
      "Check whether the support system user has been provisioned. If not, call create_support_system_user first.",
    endpoint: "GET /api/support/admin/system-user/exists",
    mutates: false,
    inputShape: {},
    handler: async (client) =>
      client.request("GET", "/api/support/admin/system-user/exists"),
  },
  {
    name: "gradsale_admin_create_support_system_user",
    title: "Create Support System User",
    description:
      "One-time provisioning of the support system user. Do not call repeatedly. Write action.",
    endpoint: "POST /api/support/admin/system-user/create",
    mutates: true,
    inputShape: {},
    handler: async (client) =>
      client.request("POST", "/api/support/admin/system-user/create"),
  },

  // ── 7. Waitlist Management ─────────────────────────────────────────────────
  {
    name: "gradsale_admin_list_waitlist_entries",
    title: "List Waitlist Entries",
    description: "List paginated waitlist email entries.",
    endpoint: "GET /api/waitlist/admin/entries",
    mutates: false,
    inputShape: { ...paginationShape },
    handler: async (client, { page, limit }) => {
      const qs = new URLSearchParams();
      if (page !== undefined) qs.set("page", String(page));
      if (limit !== undefined) qs.set("limit", String(limit));
      const q = qs.toString() ? `?${qs.toString()}` : "";
      return client.request("GET", `/api/waitlist/admin/entries${q}`);
    },
  },
  {
    name: "gradsale_admin_get_waitlist_stats",
    title: "Waitlist Stats",
    description:
      "Get waitlist stats: totals, breakdown by source, recent signup counts (24h / 7d / 30d).",
    endpoint: "GET /api/waitlist/admin/stats",
    mutates: false,
    inputShape: {},
    handler: async (client) => client.request("GET", "/api/waitlist/admin/stats"),
  },
  {
    name: "gradsale_admin_export_waitlist",
    title: "Export Waitlist",
    description:
      "Export the full waitlist as an array of emails. Sensitive — T2 data; handle via Sentura dashboard.",
    endpoint: "GET /api/waitlist/admin/export",
    mutates: false,
    inputShape: {},
    handler: async (client) => client.request("GET", "/api/waitlist/admin/export"),
  },
  {
    name: "gradsale_admin_delete_waitlist_entry",
    title: "Delete Waitlist Entry",
    description: "Delete a single waitlist entry by id. Destructive.",
    endpoint: "DELETE /api/waitlist/admin/entries/:id",
    mutates: true,
    inputShape: { entryId: uuid() },
    handler: async (client, { entryId }) =>
      client.request(
        "DELETE",
        `/api/waitlist/admin/entries/${encodeURIComponent(entryId)}`,
      ),
  },

  // ── 8. Email Verification Oversight ────────────────────────────────────────
  {
    name: "gradsale_admin_list_pending_email_verifications",
    title: "Pending Email Verifications",
    description:
      "List users whose email has not yet been verified — useful for debugging onboarding issues.",
    endpoint: "GET /api/auth/admin/pending-email-verifications",
    mutates: false,
    inputShape: {},
    handler: async (client) =>
      client.request("GET", "/api/auth/admin/pending-email-verifications"),
  },

  // ── 9. Transactions (Admin View) ───────────────────────────────────────────
  {
    name: "gradsale_admin_list_transactions",
    title: "List Transactions",
    description:
      "Search and list transactions platform-wide. Supports status filter and free-text search (buyer/seller username or listing title).",
    endpoint: "GET /api/transactions",
    mutates: false,
    inputShape: {
      status: z.string().optional(),
      search: z.string().optional(),
      ...paginationShape,
    },
    handler: async (client, args) => {
      const qs = new URLSearchParams();
      if (args.status) qs.set("status", args.status);
      if (args.search) qs.set("search", args.search);
      if (args.page !== undefined) qs.set("page", String(args.page));
      if (args.limit !== undefined) qs.set("limit", String(args.limit));
      const q = qs.toString() ? `?${qs.toString()}` : "";
      return client.request("GET", `/api/transactions${q}`);
    },
  },
  {
    name: "gradsale_admin_get_transaction",
    title: "Get Transaction",
    description:
      "Get full transaction detail (buyer, seller, listing, Stripe info, dispute, ratings).",
    endpoint: "GET /api/transactions/:id",
    mutates: false,
    inputShape: { transactionId: uuid() },
    handler: async (client, { transactionId }) =>
      client.request(
        "GET",
        `/api/transactions/${encodeURIComponent(transactionId)}`,
      ),
  },
  {
    name: "gradsale_admin_trigger_auto_complete",
    title: "Trigger Auto-Complete",
    description:
      "Manually kick the auto-complete scheduler for transactions past the hold period. Write action; returns count of completed transactions.",
    endpoint: "POST /api/transactions/admin/trigger-auto-complete",
    mutates: true,
    inputShape: {},
    handler: async (client) =>
      client.request("POST", "/api/transactions/admin/trigger-auto-complete"),
  },
];

export function listTools(options: { readOnly?: boolean } = {}): ToolDefinition[] {
  return options.readOnly ? TOOLS.filter((t) => !t.mutates) : TOOLS;
}

export function getTool(name: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.name === name);
}
