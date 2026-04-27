import type { GradSaleWebConfig } from "./config.js";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ClientOptions {
  config: GradSaleWebConfig;
  fetchFn?: FetchLike;
  /** Optional bearer token override. Useful for tests or after an explicit login. */
  tokenProvider?: () => Promise<string | undefined> | string | undefined;
}

export class GradSaleWebError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "GradSaleWebError";
  }
}

/**
 * Thin HTTP client for the GradSale web/user API. Mirrors `gradsale-admin`'s
 * client one-for-one so anything learned from the admin server (timeouts,
 * error envelopes, JSON parsing rules) carries over.
 *
 * The user-auth path differs from admin in two places:
 *   - login goes to /api/auth/login (not /api/auth/admin/login).
 *   - login response shape is { user, accessToken, refreshToken } and we
 *     only persist accessToken — refresh is left to a future iteration.
 */
export class GradSaleWebClient {
  private readonly fetchFn: FetchLike;
  private cachedToken: string | undefined;

  constructor(private readonly opts: ClientOptions) {
    this.fetchFn = opts.fetchFn ?? (globalThis.fetch as FetchLike);
    this.cachedToken = opts.config.userToken;
  }

  async request<T = unknown>(
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    pathAndQuery: string,
    body?: unknown,
    options: { auth?: boolean } = {},
  ): Promise<T> {
    const url = `${this.opts.config.apiBaseUrl}${pathAndQuery}`;
    // `auth: false` opts out of the token resolve path — used by login /
    // register / forgot-password endpoints that 4xx if a stale token is sent.
    const wantAuth = options.auth !== false;
    const token = wantAuth ? await this.resolveToken() : undefined;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.opts.config.requestTimeoutMs);

    try {
      const res = await this.fetchFn(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      const contentType = res.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json")
        ? await res.json()
        : await res.text();

      if (!res.ok) {
        throw new GradSaleWebError(
          `GradSale web request failed: ${res.status} ${res.statusText}`,
          res.status,
          payload,
        );
      }
      return payload as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Persist a token returned by login / register so subsequent calls reuse it. */
  setToken(token: string | undefined): void {
    this.cachedToken = token;
  }

  private async resolveToken(): Promise<string | undefined> {
    if (this.opts.tokenProvider) {
      const t = await this.opts.tokenProvider();
      if (t) return t;
    }
    if (this.cachedToken) return this.cachedToken;

    // Last resort: attempt login with email/password if configured.
    const { userEmailOrUsername, userPassword, deviceId } = this.opts.config;
    if (userEmailOrUsername && userPassword) {
      const login = (await this.request<{ accessToken: string }>(
        "POST",
        "/api/auth/login",
        {
          emailOrUsername: userEmailOrUsername,
          password: userPassword,
          deviceId,
        },
        { auth: false },
      )) as { accessToken: string };
      this.cachedToken = login.accessToken;
      return this.cachedToken;
    }
    return undefined;
  }
}
