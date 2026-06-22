import { Pool, type PoolConfig } from "pg";

export const CBE_DATABASE_URL_ENV = "CBE_DATABASE_URL";

export interface CbePoolOptions {
  databaseUrl?: string;
  max?: number;
  applicationName?: string;
}

export function resolveCbeDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const databaseUrl = env[CBE_DATABASE_URL_ENV]?.trim();
  if (!databaseUrl) {
    throw new Error(
      `${CBE_DATABASE_URL_ENV} is required for the cross-border business database. ` +
        "Provide it through environment/secret injection; do not commit database credentials.",
    );
  }
  return databaseUrl;
}

export function createCbePool(options: CbePoolOptions = {}): Pool {
  const config: PoolConfig = {
    connectionString: options.databaseUrl ?? resolveCbeDatabaseUrl(),
    max: options.max ?? 5,
    application_name: options.applicationName ?? "sentura-cbe-store",
  };
  return new Pool(config);
}
