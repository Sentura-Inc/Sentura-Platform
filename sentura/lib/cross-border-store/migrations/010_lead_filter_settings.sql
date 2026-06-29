create table if not exists cbe_lead_filter_settings (
  tenant_id text primary key references tenants(id),
  products_json jsonb not null,
  buyer_types_json jsonb not null,
  countries_json jsonb not null,
  updated_by_user_id text references sentura_users(id),
  updated_at timestamptz not null default now(),
  constraint cbe_lead_filter_settings_products_array check (jsonb_typeof(products_json) = 'array' and jsonb_array_length(products_json) > 0),
  constraint cbe_lead_filter_settings_buyer_types_array check (jsonb_typeof(buyer_types_json) = 'array' and jsonb_array_length(buyer_types_json) > 0),
  constraint cbe_lead_filter_settings_countries_array check (jsonb_typeof(countries_json) = 'array' and jsonb_array_length(countries_json) > 0)
);

create index if not exists cbe_lead_filter_settings_updated_idx
  on cbe_lead_filter_settings (updated_at desc);
