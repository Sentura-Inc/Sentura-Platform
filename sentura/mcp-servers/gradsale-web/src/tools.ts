import { z } from "zod";
import type { GradSaleWebClient } from "./client.js";

/**
 * GradSale Web MCP tool registry.
 *
 * Mirrors the `gradsale-admin` pattern one-for-one — see
 * `sentura/mcp-servers/gradsale-admin/src/tools.ts` for the full prose.
 * Coverage in this v0.1: Authentication (10), Listings (11), Messages (11)
 * — sections 1, 3, 6 of `ekg/api-web.md`. Other sections (Users, Cart,
 * Saved Items, Transactions, Stripe, Ratings, Disputes, Reports,
 * Notifications, Support, File Upload, Universities, Waitlist,
 * Geocoding) are intentionally out of scope for this Week-2 carry-over;
 * add follow-up tool groups in the same file when the next persona needs
 * them.
 *
 * Some endpoints unauthenticated by design (register / login / OAuth /
 * verify-email / resend / forgot / reset). Those handlers pass
 * `{ auth: false }` to the client so the resolver doesn't try to log in
 * with stale credentials before the agent has any. login / register
 * also call `client.setToken(...)` to persist the freshly-issued token.
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
    client: GradSaleWebClient,
    args: { [K in keyof S]: z.infer<S[K]> },
  ) => Promise<unknown>;
}

const paginationShape = {
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(200).optional(),
};

const uuid = () => z.string().uuid();

const locationShape = z
  .object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string().min(1),
    name: z.string().optional(),
  })
  .optional();

// Listing payload shared between create + update — mark every field optional
// here and let the create handler enforce its required subset before sending.
const createListingFields = {
  title: z.string().min(1).max(200),
  description: z.string().max(5000),
  price: z.number().positive(),
  category: z.string().min(1),
  paymentOption: z.enum(["online", "in-person", "both"]),
  imageUrls: z.array(z.string().url()).min(1).max(20),
  university: z.string().min(1),
  openToOffers: z.boolean().optional(),
  lowestPrice: z.number().positive().optional(),
  sellByDate: z.string().datetime().optional(),
  location: locationShape,
};

const updateListingFields = {
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  price: z.number().positive().optional(),
  category: z.string().min(1).optional(),
  paymentOption: z.enum(["online", "in-person", "both"]).optional(),
  imageUrls: z.array(z.string().url()).min(1).max(20).optional(),
  university: z.string().min(1).optional(),
  openToOffers: z.boolean().optional(),
  lowestPrice: z.number().positive().optional(),
  sellByDate: z.string().datetime().optional(),
  location: locationShape,
};

export const TOOLS: ToolDefinition[] = [
  // ── 1. Authentication ──────────────────────────────────────────────────────
  {
    name: "gradsale_web_register",
    title: "Register New User",
    description:
      "Create a new GradSale user account. Returns a registration acknowledgment; the user must verify their email before login succeeds. Mutating — typically routed through Sentura approval when the agent is provisioning accounts on behalf of others.",
    endpoint: "POST /api/auth/register",
    mutates: true,
    inputShape: {
      username: z.string().min(3).max(40),
      email: z.string().email(),
      password: z.string().min(8),
      phoneNumber: z.string().optional(),
      university: z.string().min(1),
      graduationYear: z.number().int().min(1900).max(2100),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipCode: z.string().optional(),
    },
    handler: async (client, args) =>
      client.request("POST", "/api/auth/register", args, { auth: false }),
  },
  {
    name: "gradsale_web_login",
    title: "Login",
    description:
      "Authenticate with email-or-username and password. Caches the returned access token on this MCP server so subsequent tool calls are auto-authenticated. Usually unnecessary — the server auto-logs-in from GRADSALE_USER_EMAIL/PASSWORD on first request.",
    endpoint: "POST /api/auth/login",
    mutates: true,
    inputShape: {
      emailOrUsername: z.string().min(1),
      password: z.string().min(1),
      deviceId: z.string().optional(),
    },
    handler: async (client, args) => {
      const result = (await client.request<{ accessToken: string }>(
        "POST",
        "/api/auth/login",
        args,
        { auth: false },
      )) as { accessToken: string };
      if (typeof result.accessToken === "string") {
        client.setToken(result.accessToken);
      }
      return result;
    },
  },
  {
    name: "gradsale_web_google_oauth",
    title: "Login or Register via Google",
    description:
      "Exchange a Google ID token for a GradSale session. If the user does not yet exist, the supplied username/university/graduationYear are used to provision them. Caches the issued access token like login does.",
    endpoint: "POST /api/auth/google",
    mutates: true,
    inputShape: {
      idToken: z.string().min(1),
      username: z.string().min(3).max(40).optional(),
      university: z.string().optional(),
      graduationYear: z.number().int().min(1900).max(2100).optional(),
      deviceId: z.string().optional(),
    },
    handler: async (client, args) => {
      const result = (await client.request<{ accessToken?: string }>(
        "POST",
        "/api/auth/google",
        args,
        { auth: false },
      )) as { accessToken?: string };
      if (typeof result.accessToken === "string") {
        client.setToken(result.accessToken);
      }
      return result;
    },
  },
  {
    name: "gradsale_web_get_me",
    title: "Get My Profile",
    description:
      "Return the authenticated user's full profile (university, verification status, Stripe onboarding state, address). Read-only.",
    endpoint: "GET /api/auth/me",
    mutates: false,
    inputShape: {},
    handler: async (client) => client.request("GET", "/api/auth/me"),
  },
  {
    name: "gradsale_web_logout",
    title: "Logout",
    description:
      "Invalidate the active session server-side and clear the cached token from this MCP server. Subsequent tool calls will re-authenticate from configured credentials, or fail if none are set.",
    endpoint: "POST /api/auth/logout",
    mutates: true,
    inputShape: {},
    handler: async (client) => {
      const result = await client.request("POST", "/api/auth/logout");
      client.setToken(undefined);
      return result;
    },
  },
  {
    name: "gradsale_web_verify_email",
    title: "Verify Email",
    description: "Confirm a user's email with the 6-digit code emailed during registration.",
    endpoint: "POST /api/auth/verify-email",
    mutates: true,
    inputShape: {
      email: z.string().email(),
      code: z.string().regex(/^\d{6}$/, "Verification code must be 6 digits"),
    },
    handler: async (client, args) =>
      client.request("POST", "/api/auth/verify-email", args, { auth: false }),
  },
  {
    name: "gradsale_web_resend_verification",
    title: "Resend Verification Code",
    description: "Resend the email-verification code to the supplied address. Idempotent.",
    endpoint: "POST /api/auth/resend-verification",
    mutates: true,
    inputShape: { email: z.string().email() },
    handler: async (client, args) =>
      client.request("POST", "/api/auth/resend-verification", args, { auth: false }),
  },
  {
    name: "gradsale_web_forgot_password",
    title: "Request Password Reset",
    description:
      "Request a password-reset code for the supplied address. Always responds 200 to prevent account enumeration; check the user's inbox to confirm.",
    endpoint: "POST /api/auth/forgot-password",
    mutates: true,
    inputShape: { email: z.string().email() },
    handler: async (client, args) =>
      client.request("POST", "/api/auth/forgot-password", args, { auth: false }),
  },
  {
    name: "gradsale_web_reset_password",
    title: "Reset Password",
    description:
      "Submit a new password using the reset code emailed by forgot-password. Returns a fresh login response and caches the new token.",
    endpoint: "POST /api/auth/reset-password",
    mutates: true,
    inputShape: {
      email: z.string().email(),
      code: z.string().regex(/^\d{6}$/, "Reset code must be 6 digits"),
      newPassword: z.string().min(8),
    },
    handler: async (client, args) => {
      const result = (await client.request<{ accessToken?: string }>(
        "POST",
        "/api/auth/reset-password",
        args,
        { auth: false },
      )) as { accessToken?: string };
      if (typeof result.accessToken === "string") {
        client.setToken(result.accessToken);
      }
      return result;
    },
  },
  {
    name: "gradsale_web_change_password",
    title: "Change Password",
    description:
      "Change the authenticated user's password. Requires the current password as proof. Mutating — agents acting on behalf of users should escalate this through Sentura approval.",
    endpoint: "PATCH /api/auth/change-password",
    mutates: true,
    inputShape: {
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    },
    handler: async (client, args) =>
      client.request("PATCH", "/api/auth/change-password", args),
  },

  // ── 3. Listings ────────────────────────────────────────────────────────────
  {
    name: "gradsale_web_list_listings",
    title: "Browse Listings",
    description:
      "Browse marketplace listings with optional filters (category, university, price range, payment option) and sort order. Anonymous access OK; pass lat/lng to enable distance-based sort.",
    endpoint: "GET /api/listings",
    mutates: false,
    inputShape: {
      q: z.string().optional(),
      category: z.string().optional(),
      university: z.string().optional(),
      minPrice: z.number().nonnegative().optional(),
      maxPrice: z.number().nonnegative().optional(),
      paymentOption: z.enum(["online", "in-person", "both"]).optional(),
      status: z.string().optional(),
      sortBy: z.enum(["newest", "price_low", "price_high", "distance"]).optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      ...paginationShape,
    },
    handler: async (client, args) => {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(args)) {
        if (v === undefined) continue;
        qs.set(k, String(v));
      }
      const q = qs.toString() ? `?${qs.toString()}` : "";
      return client.request("GET", `/api/listings${q}`);
    },
  },
  {
    name: "gradsale_web_search_listings",
    title: "Search Listings",
    description:
      "Search listings by free-text query. Same filter set as list_listings; `q` is the search term.",
    endpoint: "GET /api/listings/search",
    mutates: false,
    inputShape: {
      q: z.string().min(1),
      category: z.string().optional(),
      university: z.string().optional(),
      minPrice: z.number().nonnegative().optional(),
      maxPrice: z.number().nonnegative().optional(),
      paymentOption: z.enum(["online", "in-person", "both"]).optional(),
      sortBy: z.enum(["newest", "price_low", "price_high", "distance"]).optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      ...paginationShape,
    },
    handler: async (client, args) => {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(args)) {
        if (v === undefined) continue;
        qs.set(k, String(v));
      }
      return client.request("GET", `/api/listings/search?${qs.toString()}`);
    },
  },
  {
    name: "gradsale_web_get_user_listings",
    title: "Get Listings By User",
    description: "Return all active listings owned by a given user.",
    endpoint: "GET /api/listings/user/:userId",
    mutates: false,
    inputShape: { userId: uuid() },
    handler: async (client, { userId }) =>
      client.request("GET", `/api/listings/user/${encodeURIComponent(userId)}`),
  },
  {
    name: "gradsale_web_get_listing",
    title: "Get Listing",
    description:
      "Fetch a single listing's full detail (price, images, seller, view + inquiry counts, location).",
    endpoint: "GET /api/listings/:id",
    mutates: false,
    inputShape: { listingId: uuid() },
    handler: async (client, { listingId }) =>
      client.request("GET", `/api/listings/${encodeURIComponent(listingId)}`),
  },
  {
    name: "gradsale_web_get_similar_listings",
    title: "Get Similar Listings",
    description:
      "Return listings similar to a given one (used for the 'You may also like' rail). No auth required.",
    endpoint: "GET /api/listings/:id/similar",
    mutates: false,
    inputShape: { listingId: uuid() },
    handler: async (client, { listingId }) =>
      client.request("GET", `/api/listings/${encodeURIComponent(listingId)}/similar`),
  },
  {
    name: "gradsale_web_create_listing",
    title: "Create Listing",
    description:
      "Publish a new listing on the marketplace. Mutating — should go through Sentura approval when the agent is acting as a user (not the user themselves).",
    endpoint: "POST /api/listings",
    mutates: true,
    inputShape: createListingFields,
    handler: async (client, args) => client.request("POST", "/api/listings", args),
  },
  {
    name: "gradsale_web_create_listings_batch",
    title: "Create Listings (Batch)",
    description:
      "Create several listings in one call. Useful when migrating a seller's inventory or bulk-importing from another platform.",
    endpoint: "POST /api/listings/batch",
    mutates: true,
    inputShape: {
      listings: z.array(z.object(createListingFields)).min(1).max(50),
    },
    handler: async (client, { listings }) =>
      client.request("POST", "/api/listings/batch", listings),
  },
  {
    name: "gradsale_web_update_listing",
    title: "Update Listing",
    description:
      "Patch fields on an existing listing the user owns. Only the fields supplied are changed; omitted fields keep their previous value.",
    endpoint: "PATCH /api/listings/:id",
    mutates: true,
    inputShape: { listingId: uuid(), ...updateListingFields },
    handler: async (client, { listingId, ...body }) =>
      client.request(
        "PATCH",
        `/api/listings/${encodeURIComponent(listingId)}`,
        body,
      ),
  },
  {
    name: "gradsale_web_delete_listing",
    title: "Delete Listing",
    description:
      "Soft-delete a listing the user owns. Buyers with active interest are not notified — coordinate with messages_send_message first if you want to inform them.",
    endpoint: "DELETE /api/listings/:id",
    mutates: true,
    inputShape: { listingId: uuid() },
    handler: async (client, { listingId }) =>
      client.request("DELETE", `/api/listings/${encodeURIComponent(listingId)}`),
  },
  {
    name: "gradsale_web_set_listing_status",
    title: "Set Listing Status",
    description:
      "Toggle a listing's status: 'active' (visible & for sale), 'hidden' (temporarily off the marketplace), or 'draft' (in-progress).",
    endpoint: "PATCH /api/listings/:id/status",
    mutates: true,
    inputShape: {
      listingId: uuid(),
      status: z.enum(["active", "hidden", "draft"]),
    },
    handler: async (client, { listingId, status }) =>
      client.request(
        "PATCH",
        `/api/listings/${encodeURIComponent(listingId)}/status`,
        { status },
      ),
  },
  {
    name: "gradsale_web_mark_listing_viewed",
    title: "Mark Listing Viewed",
    description:
      "Increment a listing's view counter. Counted as a write because it mutates analytics state, but it never moves money or visibility — annotated as non-destructive for approval policies.",
    endpoint: "POST /api/listings/:id/view",
    mutates: true,
    inputShape: { listingId: uuid() },
    handler: async (client, { listingId }) =>
      client.request("POST", `/api/listings/${encodeURIComponent(listingId)}/view`),
  },

  // ── 6. Messages ────────────────────────────────────────────────────────────
  {
    name: "gradsale_web_list_threads",
    title: "List Message Threads",
    description:
      "List the user's message threads (most recent first). Each entry includes participants and a single most-recent message preview.",
    endpoint: "GET /api/messages/threads",
    mutates: false,
    inputShape: {},
    handler: async (client) => client.request("GET", "/api/messages/threads"),
  },
  {
    name: "gradsale_web_get_thread",
    title: "Get Message Thread",
    description:
      "Fetch a thread with its full message history, attachments, and read receipts. Use before send_message to ground replies in context.",
    endpoint: "GET /api/messages/threads/:id",
    mutates: false,
    inputShape: { threadId: uuid() },
    handler: async (client, { threadId }) =>
      client.request("GET", `/api/messages/threads/${encodeURIComponent(threadId)}`),
  },
  {
    name: "gradsale_web_create_thread",
    title: "Create Message Thread",
    description:
      "Open a new thread with another user, optionally attached to a listing. The first message body is sent as part of thread creation.",
    endpoint: "POST /api/messages/threads",
    mutates: true,
    inputShape: {
      recipientId: uuid(),
      body: z.string().min(1).max(4000),
      listingId: uuid().optional(),
      attachmentType: z.string().optional(),
      attachmentMetadata: z.record(z.string(), z.unknown()).optional(),
    },
    handler: async (client, args) => client.request("POST", "/api/messages/threads", args),
  },
  {
    name: "gradsale_web_send_message",
    title: "Send Message",
    description:
      "Append a message to an existing thread. Supports media / voice / quoted-message attachments — pass the relevant fields or omit them for a plain-text reply.",
    endpoint: "POST /api/messages/threads/:id/messages",
    mutates: true,
    inputShape: {
      threadId: uuid(),
      body: z.string().min(1).max(4000),
      attachmentType: z.string().optional(),
      attachmentUrl: z.string().url().optional(),
      attachmentMetadata: z.record(z.string(), z.unknown()).optional(),
      voiceDuration: z.number().nonnegative().optional(),
      quotedMessageId: uuid().optional(),
    },
    handler: async (client, { threadId, ...body }) =>
      client.request(
        "POST",
        `/api/messages/threads/${encodeURIComponent(threadId)}/messages`,
        body,
      ),
  },
  {
    name: "gradsale_web_mark_message_read",
    title: "Mark Message Read",
    description: "Mark a single message as read for the authenticated user.",
    endpoint: "PATCH /api/messages/:id/read",
    mutates: true,
    inputShape: { messageId: uuid() },
    handler: async (client, { messageId }) =>
      client.request("PATCH", `/api/messages/${encodeURIComponent(messageId)}/read`),
  },
  {
    name: "gradsale_web_mark_thread_read",
    title: "Mark Thread Read",
    description: "Mark every message in a thread as read for the authenticated user.",
    endpoint: "PATCH /api/messages/threads/:id/read",
    mutates: true,
    inputShape: { threadId: uuid() },
    handler: async (client, { threadId }) =>
      client.request(
        "PATCH",
        `/api/messages/threads/${encodeURIComponent(threadId)}/read`,
      ),
  },
  {
    name: "gradsale_web_accept_reserve",
    title: "Accept Reserve Request",
    description:
      "Seller-side: accept a buyer's reserve request. Returns the auto-generated checkout message that the buyer can pay against.",
    endpoint: "POST /api/messages/:messageId/accept-reserve",
    mutates: true,
    inputShape: { messageId: uuid() },
    handler: async (client, { messageId }) =>
      client.request(
        "POST",
        `/api/messages/${encodeURIComponent(messageId)}/accept-reserve`,
      ),
  },
  {
    name: "gradsale_web_decline_reserve",
    title: "Decline Reserve Request",
    description: "Seller-side: decline a buyer's reserve request.",
    endpoint: "POST /api/messages/:messageId/decline-reserve",
    mutates: true,
    inputShape: { messageId: uuid() },
    handler: async (client, { messageId }) =>
      client.request(
        "POST",
        `/api/messages/${encodeURIComponent(messageId)}/decline-reserve`,
      ),
  },
  {
    name: "gradsale_web_accept_price_proposal",
    title: "Accept Price Proposal",
    description:
      "Seller-side: accept a buyer's counter-price proposal. Returns the original proposal message and the auto-generated checkout message.",
    endpoint: "POST /api/messages/:messageId/accept-price-proposal",
    mutates: true,
    inputShape: { messageId: uuid() },
    handler: async (client, { messageId }) =>
      client.request(
        "POST",
        `/api/messages/${encodeURIComponent(messageId)}/accept-price-proposal`,
      ),
  },
  {
    name: "gradsale_web_decline_price_proposal",
    title: "Decline Price Proposal",
    description: "Seller-side: decline a buyer's counter-price proposal.",
    endpoint: "POST /api/messages/:messageId/decline-price-proposal",
    mutates: true,
    inputShape: { messageId: uuid() },
    handler: async (client, { messageId }) =>
      client.request(
        "POST",
        `/api/messages/${encodeURIComponent(messageId)}/decline-price-proposal`,
      ),
  },
  {
    name: "gradsale_web_complete_checkout",
    title: "Complete Checkout Message",
    description:
      "Buyer-side: mark a checkout message as completed once the underlying payment transaction is confirmed. Returns the updated checkout message and the new transaction-confirmation message.",
    endpoint: "POST /api/messages/checkout/:messageId/complete",
    mutates: true,
    inputShape: {
      messageId: uuid(),
      transactionId: uuid(),
    },
    handler: async (client, { messageId, transactionId }) =>
      client.request(
        "POST",
        `/api/messages/checkout/${encodeURIComponent(messageId)}/complete`,
        { transactionId },
      ),
  },
];

export function listTools(options: { readOnly?: boolean } = {}): ToolDefinition[] {
  return options.readOnly ? TOOLS.filter((t) => !t.mutates) : TOOLS;
}

export function getTool(name: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.name === name);
}
