import { Pool, type PoolClient, type PoolConfig, type QueryResultRow } from "pg";

export const CBE_DATABASE_URL_ENV = "CBE_DATABASE_URL";

let sharedPool: Pool | undefined;

export type CbeDb = Pool | PoolClient;

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

export function getCbePool() {
  if (!sharedPool) {
    const config: PoolConfig = {
      connectionString: resolveCbeDatabaseUrl(),
      max: 5,
      application_name: "sentura-dashboard-cbe-store",
    };
    sharedPool = new Pool(config);
  }
  return sharedPool;
}

export async function queryCbe<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  return getCbePool().query<T>(text, values);
}

export async function withCbeTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
) {
  const client = await getCbePool().connect();
  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
