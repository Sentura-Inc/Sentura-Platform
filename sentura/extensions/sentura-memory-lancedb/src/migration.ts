/**
 * One-shot migration: add the `userToken` column to a legacy `memories`
 * table written by the upstream `memory-lancedb` plugin.
 *
 * Strategy: LanceDB tables are immutable in their schema once created, so
 * we cannot just `ALTER TABLE ADD COLUMN`. Instead we read every row out
 * of the old table, drop the old table, recreate it with the new schema
 * (including `userToken: ""`), and re-insert the rows. All migrated rows
 * land as GLOBAL entries (`userToken === ""`) — that matches the
 * `user-plus-global` default scope, so legacy memories stay visible to
 * every Sentura user after the migration.
 *
 * Idempotent: if the table already has a `userToken` column the migration
 * is a no-op and reports `{ status: "already-migrated" }`.
 *
 * Invoked by:
 *   1. The extension's CLI: `openclaw ltm migrate-userToken`.
 *   2. The setup script (Step 5b, optional) for fresh installs that
 *      inherited an old table from a previous OpenClaw build.
 */

import { loadLanceDbModule } from "../lancedb-runtime.js";

const TABLE_NAME = "memories";
const GLOBAL_USER_TOKEN = "";

type MigrationLogger = {
  info?: (m: string) => void;
  warn?: (m: string) => void;
};

export type MigrationResult =
  | { status: "already-migrated"; rowCount: number }
  | { status: "migrated"; rowCount: number }
  | { status: "no-table" };

export interface MigrateOptions {
  dbPath: string;
  storageOptions?: Record<string, string>;
  logger?: MigrationLogger;
}

export async function migrateUserTokenColumn(opts: MigrateOptions): Promise<MigrationResult> {
  const lancedb = await loadLanceDbModule(opts.logger);
  const connection = await lancedb.connect(
    opts.dbPath,
    opts.storageOptions ? { storageOptions: opts.storageOptions } : {},
  );

  const tables = await connection.tableNames();
  if (!tables.includes(TABLE_NAME)) {
    opts.logger?.info?.(
      `sentura-memory-lancedb: no '${TABLE_NAME}' table at ${opts.dbPath} — nothing to migrate`,
    );
    return { status: "no-table" };
  }

  const table = await connection.openTable(TABLE_NAME);
  const sample = await table.query().limit(1).toArray();

  if (sample.length === 0) {
    // Empty table — drop and let the plugin recreate it with the new schema
    // on next boot. Safer than guessing the vector dimension here.
    await connection.dropTable(TABLE_NAME);
    opts.logger?.info?.(
      `sentura-memory-lancedb: dropped empty '${TABLE_NAME}' table; plugin will recreate on next boot`,
    );
    return { status: "migrated", rowCount: 0 };
  }

  if ("userToken" in sample[0]) {
    const rowCount = await table.countRows();
    opts.logger?.info?.(
      `sentura-memory-lancedb: '${TABLE_NAME}' already has userToken column (${rowCount} rows) — skipping`,
    );
    return { status: "already-migrated", rowCount };
  }

  // Read everything out before we drop. LanceDB rows include a
  // `_distance` column when you call `vectorSearch`, but `query()`
  // returns the bare schema fields.
  const allRows = await table.query().toArray();
  const vectorDim =
    Array.isArray(sample[0].vector) && sample[0].vector.length > 0 ? sample[0].vector.length : 1536;

  await connection.dropTable(TABLE_NAME);

  // Recreate with userToken column. We seed with a __schema__ row so the
  // table inherits the right column types, then immediately delete it.
  const newTable = await connection.createTable(TABLE_NAME, [
    {
      id: "__schema__",
      text: "",
      vector: Array.from({ length: vectorDim }).fill(0),
      importance: 0,
      category: "other",
      createdAt: 0,
      userToken: GLOBAL_USER_TOKEN,
    },
  ]);
  await newTable.delete('id = "__schema__"');

  if (allRows.length > 0) {
    const migrated = allRows.map((row) => ({
      id: row.id as string,
      text: row.text as string,
      vector: row.vector as number[],
      importance: row.importance as number,
      category: row.category as string,
      createdAt: row.createdAt as number,
      userToken: GLOBAL_USER_TOKEN,
    }));
    await newTable.add(migrated);
  }

  opts.logger?.info?.(
    `sentura-memory-lancedb: migrated ${allRows.length} rows into the userToken-aware schema (all entries flagged as GLOBAL)`,
  );
  return { status: "migrated", rowCount: allRows.length };
}
