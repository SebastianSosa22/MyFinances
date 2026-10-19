-- Ya aplicado en tu proyecto (respaldo, sin valores secretos).
-- Tabla bloqueada: sin políticas y sin permisos para anon/authenticated; solo la lee la función con la service role.
-- Claves guardadas: vapid_public_key, vapid_private_key, vapid_subject, cron_secret
create table public.app_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
