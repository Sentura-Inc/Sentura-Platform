import type { Authorizer } from "./authorizer.js";
import type { RbacStore } from "./store.js";
import type { PermissionScope, SenturaUser } from "./types.js";

/**
 * Minimal gateway handler signature matching OpenClaw's
 * `GatewayRequestHandler` from `openclaw/src/gateway/server-methods/types.ts`.
 * We duplicate the shape here so the extension does not import from OpenClaw's
 * internal `src/` paths (forbidden by `.cursorrules`).
 */
export type HandlerArgs = {
  req?: unknown;
  params: Record<string, unknown>;
  client?: unknown;
  isWebchatConnect?: unknown;
  respond: (ok: boolean, data?: unknown, error?: { code: string; message: string }) => void;
  context?: unknown;
};

export type RbacHandler = (
  args: HandlerArgs & {
    rbac: {
      user: SenturaUser;
      scope: PermissionScope;
    };
  },
) => Promise<void> | void;

export type GuardedHandler = (args: HandlerArgs) => Promise<void> | void;

export interface MiddlewareOptions {
  /**
   * The RPC method name this handler is mounted at. Used by the authorizer
   * to look up the `METHOD_POLICIES` entry.
   */
  method: string;
  /**
   * If true, the middleware enforces the RBAC check. When false, the
   * middleware still resolves the `SenturaUser` (if a token was supplied) but
   * passes the call through regardless. Defaults to true.
   */
  enforce?: boolean;
  /**
   * Name of the params field carrying the user id. Defaults to `userId`.
   * The middleware will also look up `userToken` and `actorId` as fallbacks.
   */
  userIdField?: string;
}

/**
 * Resolve the acting user from an RPC call. Looks at `params.userId`,
 * `params.userToken`, `params.actorId`, and finally `params.user?.id`.
 * Returns undefined if the call is anonymous.
 */
export async function resolveActorUser(
  store: RbacStore,
  params: Record<string, unknown>,
  userIdField = "userId",
): Promise<SenturaUser | undefined> {
  const userId = (params[userIdField] ?? params.actorId ?? (params.user as { id?: string } | undefined)?.id) as
    | string
    | undefined;
  if (userId) {
    const user = await store.getUser(userId);
    if (user) return user;
  }
  const token = params.userToken as string | undefined;
  if (token) {
    const user = await store.getUserByToken(token);
    if (user) return user;
  }
  return undefined;
}

/**
 * Wrap a gateway RPC handler with an RBAC check. Every invocation:
 *   1. resolves the acting user from the request params
 *   2. consults the `Authorizer` for the configured method
 *   3. on success, invokes the inner handler with a `rbac` context bag
 *   4. on failure, responds with a structured `FORBIDDEN` error
 *
 * Example:
 * ```ts
 * api.registerGatewayMethod(
 *   "sentura.mcp.build",
 *   withRbac(authorizer, store, { method: "sentura.mcp.build" }, async ({ params, respond, rbac }) => {
 *     // rbac.user is the authenticated SenturaUser
 *     // rbac.scope is "all" | "department" | "owned" | "self"
 *     ...
 *   }),
 * );
 * ```
 */
export function withRbac(
  authorizer: Authorizer,
  store: RbacStore,
  opts: MiddlewareOptions,
  handler: RbacHandler,
): GuardedHandler {
  const enforce = opts.enforce ?? true;

  return async (args) => {
    // Bootstrap escape: if the RBAC store is empty (no users provisioned yet),
    // skip enforcement so the first platform_admin can be seeded. Any handler
    // relying on `rbac.user` should tolerate an `__anonymous__` fallback.
    if (enforce) {
      const users = await store.listUsers();
      if (users.length === 0) {
        return handler({
          ...args,
          rbac: {
            user: { id: "__bootstrap__", role: "platform_admin" } as unknown as SenturaUser,
            scope: "all",
          },
        });
      }
    }

    const user = await resolveActorUser(store, args.params, opts.userIdField);

    if (!user) {
      if (!enforce) {
        return handler({
          ...args,
          rbac: {
            user: { id: "__anonymous__" } as unknown as SenturaUser,
            scope: "self",
          },
        });
      }
      args.respond(false, undefined, {
        code: "UNAUTHORIZED",
        message: `RBAC: no user identity found on ${opts.method} (expected userId or userToken param)`,
      });
      return;
    }

    const result = await authorizer.authorize(user.id, opts.method);
    if (!result.allowed) {
      if (!enforce) {
        return handler({
          ...args,
          rbac: { user, scope: result.filteredScope ?? "self" },
        });
      }
      args.respond(false, undefined, {
        code: "FORBIDDEN",
        message: `RBAC: role=${user.role} denied on ${opts.method}: ${result.reason ?? "no matching permission"}`,
      });
      return;
    }

    return handler({
      ...args,
      rbac: { user, scope: result.filteredScope ?? "self" },
    });
  };
}

/**
 * Bind a Sentura-style `authorize()` function that method handlers can call
 * imperatively when they want fine-grained checks inside a larger workflow
 * (for example, a single handler that touches multiple resources).
 */
export function createImperativeAuthorize(authorizer: Authorizer, store: RbacStore) {
  return async (
    params: Record<string, unknown>,
    method: string,
  ): Promise<{ ok: true; user: SenturaUser; scope: PermissionScope } | { ok: false; code: string; message: string }> => {
    const user = await resolveActorUser(store, params);
    if (!user) {
      return { ok: false, code: "UNAUTHORIZED", message: `No user on ${method}` };
    }
    const result = await authorizer.authorize(user.id, method);
    if (!result.allowed) {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: `role=${user.role} denied on ${method}: ${result.reason ?? "no permission"}`,
      };
    }
    return { ok: true, user, scope: result.filteredScope ?? "self" };
  };
}
