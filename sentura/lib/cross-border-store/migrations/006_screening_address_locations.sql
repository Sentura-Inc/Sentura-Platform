create table if not exists screening_address_locations (
  id text primary key,
  tenant_id text not null references tenants(id),
  screening_report_id text not null references screening_reports(id) on delete cascade,
  screening_target_id text not null references screening_targets(id) on delete cascade,
  lead_candidate_id text references lead_candidates(id) on delete set null,
  agent_run_id text references agent_runs(id) on delete set null,
  created_by_user_id text references sentura_users(id),
  owner_user_id text references sentura_users(id),
  department_id text,
  team_name text,
  visibility_scope text not null default 'private' check (visibility_scope in ('private', 'team', 'tenant_shared')),
  company_name text not null,
  normalized_domain text,
  google_place_id text,
  display_name text not null,
  formatted_address text not null,
  address_type text not null check (address_type in (
    'headquarters_or_office',
    'storefront',
    'warehouse_or_distribution',
    'service_or_repair_location',
    'unknown_business_location'
  )),
  relationship_status text not null check (relationship_status in (
    'confirmed_company_location',
    'probable_company_location',
    'possible_related_location',
    'rejected_unrelated_location'
  )),
  city text,
  region text,
  country text,
  business_status text,
  types_json jsonb not null default '[]'::jsonb,
  website_uri text,
  domain_match text not null default 'not_checked' check (domain_match in ('match', 'mismatch', 'not_checked')),
  phone_match text not null default 'not_checked' check (phone_match in ('match', 'mismatch', 'conflict', 'not_checked')),
  address_validation_json jsonb not null default '{}'::jsonb,
  google_maps_uri text,
  match_confidence numeric(5, 4),
  match_reasons_json jsonb not null default '[]'::jsonb,
  source_type text not null default 'google_maps_places',
  fetched_at timestamptz,
  created_at timestamptz not null default now()
);

insert into screening_address_locations (
  id,
  tenant_id,
  screening_report_id,
  screening_target_id,
  lead_candidate_id,
  agent_run_id,
  created_by_user_id,
  owner_user_id,
  department_id,
  team_name,
  visibility_scope,
  company_name,
  normalized_domain,
  google_place_id,
  display_name,
  formatted_address,
  address_type,
  relationship_status,
  city,
  region,
  country,
  business_status,
  types_json,
  website_uri,
  domain_match,
  phone_match,
  address_validation_json,
  google_maps_uri,
  match_confidence,
  match_reasons_json,
  source_type,
  fetched_at,
  created_at
)
select
  'screening_address_backfill_' || md5(
    sr.id || ':' ||
    locations.ordinal::text || ':' ||
    coalesce(location->>'google_place_id', '') || ':' ||
    coalesce(location->>'formatted_address', '')
  ),
  sr.tenant_id,
  sr.id,
  sr.screening_target_id,
  st.lead_candidate_id,
  sr.agent_run_id,
  sr.created_by_user_id,
  sr.owner_user_id,
  sr.department_id,
  sr.team_name,
  sr.visibility_scope,
  coalesce(nullif(sr.report_json->>'company_name', ''), st.company_name),
  nullif(
    split_part(
      regexp_replace(
        lower(
          coalesce(
            nullif(sr.report_json #>> '{target,domain}', ''),
            nullif(sr.report_json #>> '{target,website}', ''),
            nullif(location->>'website_uri', '')
          )
        ),
        '^https?://(www\.)?',
        ''
      ),
      '/',
      1
    ),
    ''
  ),
  nullif(location->>'google_place_id', ''),
  coalesce(nullif(location->>'display_name', ''), coalesce(nullif(sr.report_json->>'company_name', ''), st.company_name)),
  coalesce(
    nullif(location->>'formatted_address', ''),
    nullif(location #>> '{address_validation,formatted_address}', ''),
    nullif(location->>'display_name', ''),
    coalesce(nullif(sr.report_json->>'company_name', ''), st.company_name)
  ),
  case
    when location->>'address_type' in (
      'headquarters_or_office',
      'storefront',
      'warehouse_or_distribution',
      'service_or_repair_location',
      'unknown_business_location'
    )
      then location->>'address_type'
    else 'unknown_business_location'
  end,
  case
    when location->>'relationship_status' in (
      'confirmed_company_location',
      'probable_company_location',
      'possible_related_location',
      'rejected_unrelated_location'
    )
      then location->>'relationship_status'
    else 'possible_related_location'
  end,
  nullif(location->>'city', ''),
  nullif(location->>'region', ''),
  coalesce(nullif(location->>'country', ''), nullif(sr.report_json #>> '{target,country}', '')),
  nullif(location->>'business_status', ''),
  case when jsonb_typeof(location->'types') = 'array' then location->'types' else '[]'::jsonb end,
  nullif(location->>'website_uri', ''),
  case
    when location->>'domain_match' = 'true' then 'match'
    when location->>'domain_match' = 'false' then 'mismatch'
    else 'not_checked'
  end,
  case
    when location->>'phone_match' = 'true' then 'match'
    when location->>'phone_match' = 'false' then 'mismatch'
    when location->>'phone_match' = 'conflict' then 'conflict'
    else 'not_checked'
  end,
  case when jsonb_typeof(location->'address_validation') = 'object' then location->'address_validation' else '{}'::jsonb end,
  nullif(location->>'google_maps_uri', ''),
  case
    when location->>'match_confidence' ~ '^[0-9]+(\.[0-9]+)?$'
      then least((location->>'match_confidence')::numeric, 9.9999)::numeric(5, 4)
    else null
  end,
  case when jsonb_typeof(location->'match_reasons') = 'array' then location->'match_reasons' else '[]'::jsonb end,
  coalesce(nullif(location->>'source_type', ''), 'google_maps_places'),
  case when nullif(location->>'fetched_at', '') is not null then (location->>'fetched_at')::timestamptz else null end,
  sr.created_at
from screening_reports sr
join screening_targets st
  on st.tenant_id = sr.tenant_id
  and st.id = sr.screening_target_id
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(sr.report_json #> '{address_footprint,locations}') = 'array'
      then sr.report_json #> '{address_footprint,locations}'
    else '[]'::jsonb
  end
) with ordinality as locations(location, ordinal)
on conflict (id) do nothing;

create index if not exists screening_address_locations_report_idx
  on screening_address_locations(tenant_id, screening_report_id);

create index if not exists screening_address_locations_target_idx
  on screening_address_locations(tenant_id, screening_target_id, created_at desc);

create index if not exists screening_address_locations_place_idx
  on screening_address_locations(tenant_id, google_place_id)
  where google_place_id is not null;

create index if not exists screening_address_locations_country_city_idx
  on screening_address_locations(tenant_id, country, city);

create index if not exists screening_address_locations_domain_idx
  on screening_address_locations(tenant_id, normalized_domain)
  where normalized_domain is not null;
