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
  abstractBaseUrl: z.string().url().default("https://emailreputation.abstractapi.com/v1/"),
  hunterApiKey: z.string().min(1).optional(),
  hunterBaseUrl: z.string().url().default("https://api.hunter.io/v2"),
  volzaApiKey: z.string().min(1).optional(),
  volzaBaseUrl: z.string().url().default("https://api.volza.com"),
  importYetiApiKey: z.string().min(1).optional(),
  importYetiBaseUrl: z.string().url().default("https://data.importyeti.com"),
  googleMapsApiKey: z.string().min(1).optional(),
  googleMapsPlacesBaseUrl: z.string().url().default("https://places.googleapis.com/v1"),
  googleMapsGeocodingBaseUrl: z.string().url().default("https://maps.googleapis.com/maps/api/geocode/json"),
  googleMapsAddressValidationBaseUrl: z.string().url().default("https://addressvalidation.googleapis.com/v1:validateAddress"),
  googleMapsMaxResultsPerSearch: z.number().int().min(1).max(20).default(10),
  googleMapsMaxDetailsPerRun: z.number().int().min(1).max(50).default(20),
  googleMapsMaxAddressValidationPerRun: z.number().int().min(1).max(20).default(5),
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
    hunterBaseUrl: env.HUNTER_BASE_URL,
    volzaApiKey: env.VOLZA_API_KEY,
    volzaBaseUrl: env.VOLZA_BASE_URL,
    importYetiApiKey: env.IMPORTYETI_API_KEY,
    importYetiBaseUrl: env.IMPORTYETI_BASE_URL,
    googleMapsApiKey: env.GOOGLE_MAPS_API_KEY,
    googleMapsPlacesBaseUrl: env.GOOGLE_MAPS_PLACES_BASE_URL,
    googleMapsGeocodingBaseUrl: env.GOOGLE_MAPS_GEOCODING_BASE_URL,
    googleMapsAddressValidationBaseUrl: env.GOOGLE_MAPS_ADDRESS_VALIDATION_BASE_URL,
    googleMapsMaxResultsPerSearch: optionalNumber(env.CBE_GOOGLE_MAPS_MAX_RESULTS_PER_SEARCH),
    googleMapsMaxDetailsPerRun: optionalNumber(env.CBE_GOOGLE_MAPS_MAX_DETAILS_PER_RUN),
    googleMapsMaxAddressValidationPerRun: optionalNumber(env.CBE_GOOGLE_MAPS_MAX_ADDRESS_VALIDATION_PER_RUN),
    enablePaidTradeData:
      env.CBE_ENABLE_PAID_TRADE_DATA === "true" ||
      env.CBE_ENABLE_PAID_TRADE_DATA === "1",
    maxPaidSpendUsd: optionalNumber(env.CBE_MAX_PAID_SPEND_USD),
    requestTimeoutMs: optionalNumber(env.CBE_INTEL_REQUEST_TIMEOUT_MS),
  });
}
