-- Ejecuta esto en Supabase > SQL Editor (proyecto finanzas-503020)
create table if not exists public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  cycle text not null default 'weekly' check (cycle in ('weekly','biweekly','monthly')),
  reserve_pct smallint not null default 0 check (reserve_pct between 0 and 50),
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
create policy "settings_select_own" on public.user_settings for select to authenticated using (user_id = (select auth.uid()));
create policy "settings_insert_own" on public.user_settings for insert to authenticated with check (user_id = (select auth.uid()));
create policy "settings_update_own" on public.user_settings for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "settings_delete_own" on public.user_settings for delete to authenticated using (user_id = (select auth.uid()));
