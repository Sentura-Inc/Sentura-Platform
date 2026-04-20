import { z } from "zod";

const ConfigSchema = z.object({
  apiBaseUrl: z.string().url(),
  adminToken: z.string().min(1).optional(),
  adminEmail: z.string().email().optional(),
  adminPassword: z.string().min(1).optional(),
  requestTimeoutMs: z.number().int().positive().default(30_000),
  readOnly: z.boolean().default(false),
});

export type GradSaleAdminConfig = z.infer<typeof ConfigSchema>;

export function loadConfigFromEnv(env: NodeJS.ProcessEnv = process.env): GradSaleAdminConfig {
  const parsed = ConfigSchema.parse({
    apiBaseUrl: env.GRADSALE_API_URL ?? "http://localhost:3001",
    adminToken: env.GRADSALE_ADMIN_TOKEN,
    adminEmail: env.GRADSALE_ADMIN_EMAIL,
    adminPassword: env.GRADSALE_ADMIN_PASSWORD,
    requestTimeoutMs: env.GRADSALE_REQUEST_TIMEOUT_MS
      ? Number(env.GRADSALE_REQUEST_TIMEOUT_MS)
      : undefined,
    // READ_ONLY mode locks out PATCH/POST/DELETE tools — useful for investigation-only employees
    // (e.g. auditor personas). Flip on via config.patch at runtime.
    readOnly: env.GRADSALE_READ_ONLY === "true" || env.GRADSALE_READ_ONLY === "1",
  });
  return parsed;
}
