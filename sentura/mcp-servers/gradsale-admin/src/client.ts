import type { GradSaleAdminConfig } from "./config.js";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ClientOptions {
  config: GradSaleAdminConfig;
  fetchFn?: FetchLike;
  /** Optional bearer token override. Useful for tests or when a fresh login is in hand. */
  tokenProvider?: () => Promise<string | undefined> | string | undefined;
}

export class GradSaleAdminError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "GradSaleAdminError";
  }
}

/**
 * Thin HTTP client that wraps the GradSale backend with admin JWT auth.
 * Intentionally minimal — all business validation lives in the tool handlers.
 */
export class GradSaleAdminClient {
  private readonly fetchFn: FetchLike;
  private cachedToken: string | undefined;

  constructor(private readonly opts: ClientOptions) {
    this.fetchFn = opts.fetchFn ?? (globalThis.fetch as FetchLike);
    this.cachedToken = opts.config.adminToken;
  }

  async request<T = unknown>(
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    pathAndQuery: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.opts.config.apiBaseUrl}${pathAndQuery}`;
    const token = await this.resolveToken();
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
      const payload = contentType.includes("application/json") ? await res.json() : await res.text();

      if (!res.ok) {
        throw new GradSaleAdminError(
          `GradSale admin request failed: ${res.status} ${res.statusText}`,
          res.status,
          payload,
        );
      }
      return payload as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async resolveToken(): Promise<string | undefined> {
    if (this.opts.tokenProvider) {
      const t = await this.opts.tokenProvider();
      if (t) return t;
    }
    if (this.cachedToken) return this.cachedToken;

    // Last resort: attempt login with email/password if configured
    const { adminEmail, adminPassword } = this.opts.config;
    if (adminEmail && adminPassword) {
      const login = (await this.request<{ accessToken: string }>(
        "POST",
        "/api/auth/admin/login",
        { email: adminEmail, password: adminPassword },
      )) as { accessToken: string };
      this.cachedToken = login.accessToken;
      return this.cachedToken;
    }
    return undefined;
  }
}
