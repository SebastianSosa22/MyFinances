-- Endurecimiento de seguridad (revisión de oct. 2026). No borra ni cambia datos: solo agrega reglas.
-- Antes de escribirlo se revisó que todos los datos actuales ya cumplen estos límites.

-- 1) Límites de tamaño: evita que alguien llene la base con textos o JSON enormes ---------------
alter table public.movements
  add constraint movements_note_len check (note is null or char_length(note) <= 200),
  add constraint movements_cat_len check (cat is null or char_length(cat) <= 40);
alter table public.goals
  add constraint goals_name_len check (char_length(name) between 1 and 60);
alter table public.category_limits
  add constraint category_limits_cat_len check (char_length(cat) between 1 and 40);
alter table public.app_events
  add constraint app_events_props_size check (pg_column_size(props) <= 4096);
alter table public.push_subscriptions
  add constraint push_tz_len check (char_length(tz) <= 64),
  add constraint push_keys_len check (char_length(p256dh) <= 256 and char_length(auth) <= 256),
  add constraint push_prefs_size check (pg_column_size(prefs) <= 2048),
  -- 2) Solo servicios de notificaciones reales: impide que el servidor haga POST a URLs arbitrarias
  add constraint push_endpoint_host check (
    char_length(endpoint) <= 1024 and endpoint ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/'
  );

-- 3) Un movimiento solo puede ligarse a cuentas y metas propias (igual que las transferencias) -----
create or replace function public.owns_goal(goal uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select goal is null or exists (select 1 from public.goals g where g.id = goal and g.user_id = (select auth.uid()));
$$;
revoke all on function public.owns_goal(uuid) from public, anon;
grant execute on function public.owns_goal(uuid) to authenticated;

drop policy movements_insert_own on public.movements;
create policy movements_insert_own on public.movements for insert to authenticated
  with check (user_id = (select auth.uid()) and public.owns_account(account_id) and public.owns_goal(goal_id));
drop policy movements_update_own on public.movements;
create policy movements_update_own on public.movements for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_account(account_id) and public.owns_goal(goal_id));
