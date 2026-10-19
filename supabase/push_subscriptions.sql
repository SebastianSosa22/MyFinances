-- Ya aplicado en tu proyecto (respaldo)
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  tz text not null default 'America/Mexico_City',
  prefs jsonb not null default '{"on":false,"daily":false,"close":true,"before":1,"hour":9}'::jsonb,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "push_select_own" on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy "push_insert_own" on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy "push_update_own" on public.push_subscriptions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "push_delete_own" on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));
