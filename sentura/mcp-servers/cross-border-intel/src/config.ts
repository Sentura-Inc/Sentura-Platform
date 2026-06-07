import { z } from "zod";

const ConfigSchema = z.object({
  companiesHouseApiKey: z.string().min(1).optional(),
  companiesHouseBaseUrl: z.string().url().default("https://api.company-information.service.gov.uk"),
  openCorporatesApiKey: z.string().min(1).optional(),
  openCorporatesBaseUrl: z.string().url().default("https://api.opencorporates.com/v0.4"),
  rdapBaseUrl: z.string().url().default("https://rdap.org"),
  secBaseUrl: z.string().url().default("https://data.sec.gov"),
  secUserAgent: z.string().min(8).default("SenturaCrossBorderIntel/0.1 contact=ops@example.invalid"),
  abstractApiKey: z.string().min(1).optional(),
  abstractBaseUrl: z.string().url().default("https://emailvalidation.abstractapi.com/v1/"),
  hunterApiKey: z.string().min(1).optional(),
  volzaApiKey: z.string().min(1).optional(),
  volzaBaseUrl: z.string().url().default("https://api.volza.com"),
  importYetiApiKey: z.string().min(1).optional(),
  importYetiBaseUrl: z.string().url().default("https://www.importyeti.com/api"),
  enablePaidTradeData: z.boolean().default(false),
  maxPaidSpendUsd: z.number().min(0).default(0),
  requestTimeoutMs: z.number().int().positive().default(30_000),
});

export type CrossBorderIntelConfig = z.infer<typeof ConfigSchema>;

function optionalNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function loadConfigFromEnv(env: NodeJS.ProcessEnv = process.env): CrossBorderIntelConfig {
  return ConfigSchema.parse({
    companiesHouseApiKey: env.COMPANIES_HOUSE_API_KEY,
    companiesHouseBaseUrl: env.COMPANIES_HOUSE_BASE_URL,
    openCorporatesApiKey: env.OPENCORPORATES_API_KEY,
    openCorporatesBaseUrl: env.OPENCORPORATES_BASE_URL,
    rdapBaseUrl: env.RDAP_BASE_URL,
    secBaseUrl: env.SEC_BASE_URL,
    secUserAgent: env.SEC_USER_AGENT,
    abstractApiKey: env.ABSTRACT_API_KEY,
    abstractBaseUrl: env.ABSTRACT_BASE_URL,
    hunterApiKey: env.HUNTER_API_KEY,
    volzaApiKey: env.VOLZA_API_KEY,
    volzaBaseUrl: env.VOLZA_BASE_URL,
    importYetiApiKey: env.IMPORTYETI_API_KEY,
    importYetiBaseUrl: env.IMPORTYETI_BASE_URL,
    enablePaidTradeData:
      env.CBE_ENABLE_PAID_TRADE_DATA === "true" ||
      env.CBE_ENABLE_PAID_TRADE_DATA === "1",
    maxPaidSpendUsd: optionalNumber(env.CBE_MAX_PAID_SPEND_USD),
    requestTimeoutMs: optionalNumber(env.CBE_INTEL_REQUEST_TIMEOUT_MS),
  });
}
