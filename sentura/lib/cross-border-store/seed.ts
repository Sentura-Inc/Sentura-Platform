import type { Pool, PoolClient } from "pg";
import { randomBytes, scryptSync } from "node:crypto";
import {
  CBE_DATA_REGION,
  CBE_SEED_USERS,
  CBE_TENANT_DISPLAY_NAME,
  CBE_TENANT_ID,
  CBE_TENANT_SLUG,
} from "./ids.js";
import { CbeSeedSummarySchema, type CbeSeedSummary } from "./schemas.js";

type SeedUser = (typeof CBE_SEED_USERS)[keyof typeof CBE_SEED_USERS];

function hashCbePassword(password: string) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

function seededPasswordHash(user: SeedUser) {
  return "defaultPassword" in user ? hashCbePassword(user.defaultPassword) : null;
}

async function seedWithClient(client: PoolClient): Promise<CbeSeedSummary> {
  await client.query(
    `
      insert into tenants (id, slug, display_name, data_region)
      values ($1, $2, $3, $4)
      on conflict (id) do update set
        slug = excluded.slug,
        display_name = excluded.display_name,
        data_region = excluded.data_region
    `,
    [CBE_TENANT_ID, CBE_TENANT_SLUG, CBE_TENANT_DISPLAY_NAME, CBE_DATA_REGION],
  );

  for (const user of Object.values(CBE_SEED_USERS)) {
    await client.query(
      `
        insert into sentura_users (id, tenant_id, display_name, role, department_id, user_token_hash)
        values ($1, $2, $3, $4, $5, null)
        on conflict (id) do update set
          display_name = excluded.display_name,
          role = excluded.role,
          department_id = excluded.department_id
      `,
      [user.id, CBE_TENANT_ID, user.displayName, user.role, user.departmentId],
    );

    await client.query(
      `
        insert into cbe_user_profiles (
          id,
          tenant_id,
          user_id,
          cbe_role,
          display_name,
          team_name,
          status,
          password_hash
        )
        values ($1, $2, $3, $4, $5, $6, 'active', $7)
        on conflict (tenant_id, user_id) do update set
          cbe_role = excluded.cbe_role,
          display_name = excluded.display_name,
          team_name = excluded.team_name,
          status = excluded.status,
          password_hash = coalesce(excluded.password_hash, cbe_user_profiles.password_hash)
      `,
      [user.profileId, CBE_TENANT_ID, user.id, user.cbeRole, user.displayName, user.teamName, seededPasswordHash(user)],
    );
  }

  const summary = await client.query<{
    seeded_users: string;
    admin_profiles: string;
    operator_profiles: string;
  }>(
    `
      select
        count(distinct su.id) as seeded_users,
        count(distinct cup.id) filter (where cup.cbe_role = 'admin') as admin_profiles,
        count(distinct cup.id) filter (where cup.cbe_role = 'operator') as operator_profiles
      from sentura_users su
      left join cbe_user_profiles cup
        on cup.tenant_id = su.tenant_id
        and cup.user_id = su.id
      where su.tenant_id = $1
    `,
    [CBE_TENANT_ID],
  );

  const row = summary.rows[0];
  return CbeSeedSummarySchema.parse({
    tenantId: CBE_TENANT_ID,
    seededUsers: Number(row.seeded_users),
    adminProfiles: Number(row.admin_profiles),
    operatorProfiles: Number(row.operator_profiles),
  });
}

export async function seedCrossBorderStore(pool: Pool): Promise<CbeSeedSummary> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await seedWithClient(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
