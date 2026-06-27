alter table accio_imports
  add column if not exists source_kind text not null default 'manual_json'
    check (source_kind in ('manual_json', 'manual_text', 'manual_image', 'alibaba_international', 'demo_data', 'other'));

alter table accio_imports
  add column if not exists input_format text not null default 'json'
    check (input_format in ('json', 'pasted_text', 'image'));

alter table accio_imports
  add column if not exists attachment_metadata_json jsonb not null default '[]'::jsonb;

create index if not exists accio_imports_source_kind_idx
  on accio_imports(tenant_id, source_kind, input_format, uploaded_at desc);
