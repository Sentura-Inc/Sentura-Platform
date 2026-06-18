alter table cbe_user_profiles
  add column if not exists password_hash text;

create index if not exists cbe_user_profiles_operator_login_idx
  on cbe_user_profiles(tenant_id, lower(display_name), cbe_role, status);
