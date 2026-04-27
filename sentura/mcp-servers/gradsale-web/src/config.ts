import { z } from "zod";

const ConfigSchema = z.object({
  apiBaseUrl: z.string().url(),
  /** Pre-issued user access token. Skip the auto-login dance when set. */
  userToken: z.string().min(1).optional(),
  /** Email or username — paired with userPassword to obtain a token on first call. */
  userEmailOrUsername: z.string().min(1).optional(),
  userPassword: z.string().min(1).optional(),
  /**
   * Optional `deviceId` recorded against the session at login time. Useful
   * when running multiple Sentura employees against the same user account
   * (e.g. one per department) so the GradSale audit log can tell them apart.
   */
  deviceId: z.string().optional(),
  requestTimeoutMs: z.number().int().positive().default(30_000),
  readOnly: z.boolean().default(false),
});

export type GradSaleWebConfig = z.infer<typeof ConfigSchema>;

export function loadConfigFromEnv(env: NodeJS.ProcessEnv = process.env): GradSaleWebConfig {
  const parsed = ConfigSchema.parse({
    apiBaseUrl: env.GRADSALE_API_URL ?? "http://localhost:3001",
    userToken: env.GRADSALE_USER_TOKEN,
    userEmailOrUsername: env.GRADSALE_USER_EMAIL ?? env.GRADSALE_USER_USERNAME,
    userPassword: env.GRADSALE_USER_PASSWORD,
    deviceId: env.GRADSALE_DEVICE_ID,
    requestTimeoutMs: env.GRADSALE_REQUEST_TIMEOUT_MS
      ? Number(env.GRADSALE_REQUEST_TIMEOUT_MS)
      : undefined,
    // READ_ONLY mode locks out PATCH/POST/DELETE tools — useful for
    // analytics-only personas that browse listings and threads without
    // touching state. Flip on via config.patch at runtime.
    readOnly: env.GRADSALE_READ_ONLY === "true" || env.GRADSALE_READ_ONLY === "1",
  });
  return parsed;
}
