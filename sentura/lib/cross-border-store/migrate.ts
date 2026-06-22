import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool, PoolClient } from "pg";
import { createCbePool } from "./db.js";
import { seedCrossBorderStore } from "./seed.js";
import { CbeMigrationFileSchema, type CbeMigrationFile, type CbeSeedSummary } from "./schemas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CBE_MIGRATIONS_DIR = path.join(__dirname, "migrations");

export interface CbeMigrationResult {
  applied: CbeMigrationFile[];
  skipped: CbeMigrationFile[];
  seed?: CbeSeedSummary;
}

interface MigrationRunnerOptions {
  databaseUrl?: string;
  migrationsDir?: string;
  pool?: Pool;
  seed?: boolean;
}

function checksumSql(sql: string): string {
  return crypto.createHash("sha256").update(sql).digest("hex");
}

export async function listCbeMigrationFiles(
  migrationsDir = CBE_MIGRATIONS_DIR,
): Promise<CbeMigrationFile[]> {
  const entries = await fs.readdir(migrationsDir);
  const files: CbeMigrationFile[] = [];

  for (const fileName of entries.filter((entry) => entry.endsWith(".sql")).sort()) {
    const match = fileName.match(/^(\d{3})_(.+)\.sql$/);
    if (!match) {
      throw new Error(`Invalid CBE migration filename: ${fileName}`);
    }

    const sql = await fs.readFile(path.join(migrationsDir, fileName), "utf-8");
    files.push(
      CbeMigrationFileSchema.parse({
        id: match[1],
        name: match[2],
        fileName,
        checksum: checksumSql(sql),
      }),
    );
  }

  return files;
}

async function ensureMigrationTable(client: PoolClient): Promise<void> {
  await client.query(`
    create table if not exists cbe_schema_migrations (
      id text primary key,
      name text not null,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);
}

async function loadAppliedMigrations(client: PoolClient): Promise<Map<string, string>> {
  const result = await client.query<{ id: string; checksum: string }>(
    "select id, checksum from cbe_schema_migrations order by id",
  );
  return new Map(result.rows.map((row) => [row.id, row.checksum]));
}

async function applyMigration(
  client: PoolClient,
  migration: CbeMigrationFile,
  migrationsDir: string,
): Promise<void> {
  const sql = await fs.readFile(path.join(migrationsDir, migration.fileName), "utf-8");
  await client.query(sql);
  await client.query(
    `
      insert into cbe_schema_migrations (id, name, checksum)
      values ($1, $2, $3)
      on conflict (id) do nothing
    `,
    [migration.id, migration.name, migration.checksum],
  );
}

export async function migrateCbeDatabase(
  options: MigrationRunnerOptions = {},
): Promise<CbeMigrationResult> {
  const migrationsDir = options.migrationsDir ?? CBE_MIGRATIONS_DIR;
  const pool = options.pool ?? createCbePool({ databaseUrl: options.databaseUrl });
  const ownsPool = !options.pool;
  const client = await pool.connect();

  try {
    const migrations = await listCbeMigrationFiles(migrationsDir);
    const applied: CbeMigrationFile[] = [];
    const skipped: CbeMigrationFile[] = [];

    await client.query("begin");
    await ensureMigrationTable(client);
    const appliedChecksums = await loadAppliedMigrations(client);

    for (const migration of migrations) {
      const existingChecksum = appliedChecksums.get(migration.id);
      if (existingChecksum) {
        if (existingChecksum !== migration.checksum) {
          throw new Error(
            `CBE migration ${migration.fileName} checksum changed after it was applied`,
          );
        }
        skipped.push(migration);
        continue;
      }
      await applyMigration(client, migration, migrationsDir);
      applied.push(migration);
    }

    await client.query("commit");

    const result: CbeMigrationResult = { applied, skipped };
    if (options.seed) {
      result.seed = await seedCrossBorderStore(pool);
    }
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    if (ownsPool) {
      await pool.end();
    }
  }
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  const seed = process.argv.includes("--seed");
  migrateCbeDatabase({ seed })
    .then((result) => {
      console.log(
        JSON.stringify(
          {
            applied: result.applied.map((migration) => migration.fileName),
            skipped: result.skipped.map((migration) => migration.fileName),
            seed: result.seed,
          },
          null,
          2,
        ),
      );
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
