import {
  DEFAULT_LEAD_FILTER_SETTINGS,
  type LeadFilterSettings,
} from "../cross-border-lead-settings";
import { createAuditEvent } from "./audit";
import { queryCbe, withCbeTransaction } from "./db";
import { CbeStoreError } from "./errors";
import {
  LeadFilterSettingsInputSchema,
  type LeadFilterSettingsInput,
  type TenantContext,
} from "./schemas";
import { requireCbeAdmin } from "./tenant-context";

interface LeadFilterSettingsRow {
  products_json: unknown;
  buyer_types_json: unknown;
  countries_json: unknown;
  updated_by_user_id: string | null;
  updated_at: Date | null;
}

function isUndefinedTableError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "42P01");
}

function defaultLeadFilterSettings(): LeadFilterSettings {
  return {
    products: DEFAULT_LEAD_FILTER_SETTINGS.products.map((item) => ({ ...item })),
    buyerTypes: DEFAULT_LEAD_FILTER_SETTINGS.buyerTypes.map((item) => ({ ...item })),
    countries: DEFAULT_LEAD_FILTER_SETTINGS.countries.map((item) => ({ ...item })),
    updatedAt: null,
    updatedByUserId: null,
    source: "default",
  };
}

function settingsFromInput(
  input: LeadFilterSettingsInput,
  metadata: { updatedAt?: Date | string | null; updatedByUserId?: string | null; source: "default" | "tenant" },
): LeadFilterSettings {
  const canonicalInput = canonicalizeLeadFilterSettingsInput(input);
  return {
    products: canonicalInput.products,
    buyerTypes: canonicalInput.buyerTypes,
    countries: canonicalInput.countries,
    updatedAt: metadata.updatedAt instanceof Date ? metadata.updatedAt.toISOString() : metadata.updatedAt ?? null,
    updatedByUserId: metadata.updatedByUserId ?? null,
    source: metadata.source,
  };
}

function canonicalizeLeadFilterSettingsInput(input: LeadFilterSettingsInput): LeadFilterSettingsInput {
  return {
    products: input.products.map((item) => ({
      ...item,
      keyword: item.label,
    })),
    buyerTypes: input.buyerTypes.map((item) => ({
      ...item,
      keyword: item.label,
    })),
    countries: input.countries,
  };
}

function settingsFromRow(row: LeadFilterSettingsRow): LeadFilterSettings {
  const parsed = LeadFilterSettingsInputSchema.parse({
    products: row.products_json,
    buyerTypes: row.buyer_types_json,
    countries: row.countries_json,
  });
  return settingsFromInput(parsed, {
    updatedAt: row.updated_at,
    updatedByUserId: row.updated_by_user_id,
    source: "tenant",
  });
}

export async function getLeadFilterSettings(context: TenantContext): Promise<LeadFilterSettings> {
  try {
    const result = await queryCbe<LeadFilterSettingsRow>(
      `
        select products_json, buyer_types_json, countries_json, updated_by_user_id, updated_at
        from cbe_lead_filter_settings
        where tenant_id = $1
        limit 1
      `,
      [context.tenantId],
    );
    const row = result.rows[0];
    return row ? settingsFromRow(row) : defaultLeadFilterSettings();
  } catch (error) {
    if (isUndefinedTableError(error)) return defaultLeadFilterSettings();
    throw error;
  }
}

export async function updateLeadFilterSettings(
  context: TenantContext,
  rawInput: LeadFilterSettingsInput,
): Promise<LeadFilterSettings> {
  requireCbeAdmin(context);
  const input = canonicalizeLeadFilterSettingsInput(LeadFilterSettingsInputSchema.parse(rawInput));

  return withCbeTransaction(async (client) => {
    try {
      const result = await client.query<LeadFilterSettingsRow>(
        `
          insert into cbe_lead_filter_settings (
            tenant_id,
            products_json,
            buyer_types_json,
            countries_json,
            updated_by_user_id,
            updated_at
          )
          values ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, now())
          on conflict (tenant_id) do update set
            products_json = excluded.products_json,
            buyer_types_json = excluded.buyer_types_json,
            countries_json = excluded.countries_json,
            updated_by_user_id = excluded.updated_by_user_id,
            updated_at = now()
          returning products_json, buyer_types_json, countries_json, updated_by_user_id, updated_at
        `,
        [
          context.tenantId,
          JSON.stringify(input.products),
          JSON.stringify(input.buyerTypes),
          JSON.stringify(input.countries),
          context.userId,
        ],
      );

      await createAuditEvent(client, context, {
        eventType: "lead_filter_settings_updated",
        dataTier: "T1",
        metadataJson: {
          product_count: input.products.length,
          buyer_type_count: input.buyerTypes.length,
          country_count: input.countries.length,
        },
      });

      return settingsFromRow(result.rows[0]);
    } catch (error) {
      if (isUndefinedTableError(error)) {
        throw new CbeStoreError(
          500,
          "lead_filter_settings_migration_required",
          "Lead filter settings table is missing. Run CBE database migrations before saving settings.",
        );
      }
      throw error;
    }
  });
}
