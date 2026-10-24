-- Roles de usuario (user / admin), bitácora de uso y estadísticas para el panel de administrador.
-- Ya aplicado en el proyecto finanzas-503020 (migraciones roles_admin_y_bitacora_de_uso, admin_dashboard_fix_series_tz, is_admin_revoke_anon). Se guarda aquí como referencia.

-- 1) Rol de la cuenta ---------------------------------------------------------------
create type public.app_role as enum ('user', 'admin');

-- Tabla de usuarios de la app (una fila por cuenta de auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);
alter table public.profiles enable row level security;

-- Todas las cuentas que ya existen quedan con rol "user"
insert into public.profiles (id, email, full_name, created_at, last_seen_at, role)
select u.id, u.email, u.raw_user_meta_data ->> 'full_name', u.created_at, u.last_sign_in_at, 'user'
from auth.users u
on conflict (id) do update set role = 'user';

-- Cuentas nuevas: se crea su perfil automáticamente con rol "user"
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, created_at)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', new.created_at)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Si el usuario cambia su nombre o correo, se refleja en su perfil
create or replace function public.handle_user_updated()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles
     set email = new.email, full_name = new.raw_user_meta_data ->> 'full_name'
   where id = new.id;
  return new;
end $$;
create trigger on_auth_user_updated after update of email, raw_user_meta_data on auth.users
  for each row execute function public.handle_user_updated();

-- ¿La cuenta que llama es administradora?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;

-- Cada quien ve su perfil; un admin ve todos. Nadie cambia su propio rol desde la app.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

-- 2) Bitácora de uso -----------------------------------------------------------------
create table public.app_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id text,
  name text not null check (char_length(name) between 1 and 60),
  screen text check (char_length(screen) <= 40),
  props jsonb not null default '{}'::jsonb,
  platform text check (char_length(platform) <= 40),
  created_at timestamptz not null default now()
);
create index app_events_created_idx on public.app_events (created_at desc);
create index app_events_user_idx on public.app_events (user_id, created_at desc);
create index app_events_name_idx on public.app_events (name, created_at desc);
alter table public.app_events enable row level security;
create policy app_events_insert_own on public.app_events for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy app_events_select_admin on public.app_events for select to authenticated
  using ((select public.is_admin()));

-- Marca la última vez que la cuenta abrió la app (lo llama la app al iniciar)
create or replace function public.touch_last_seen()
returns void language sql security definer set search_path = '' as $$
  update public.profiles set last_seen_at = now() where id = (select auth.uid());
$$;

-- 3) Cambiar el rol de una cuenta (solo admins; nunca deja la app sin admin) ------------
create or replace function public.admin_set_role(target uuid, new_role public.app_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Solo un administrador puede cambiar roles'; end if;
  if new_role = 'user' and (select count(*) from public.profiles where role = 'admin' and id <> target) = 0 then
    raise exception 'Debe quedar al menos un administrador';
  end if;
  update public.profiles set role = new_role where id = target;
end $$;

-- 4) Estadísticas del panel (solo admins). Solo conteos: no expone montos individuales. ---
create or replace function public.admin_dashboard(days int default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/Mexico_City';
  d int := greatest(1, least(coalesce(days, 30), 365));
  since timestamptz := date_trunc('day', now() at time zone tz) at time zone tz - make_interval(days => d - 1);
  today timestamptz := date_trunc('day', now() at time zone tz) at time zone tz;
  result jsonb;
begin
  if not public.is_admin() then raise exception 'Acceso solo para administradores' using errcode = '42501'; end if;

  with
  -- "Actividad" = abrir la app/usar una pantalla (bitácora), registrar un movimiento o iniciar sesión
  act as (
    select user_id, created_at as at from public.app_events
    union all select user_id, created_at from public.movements
    union all select id, last_sign_in_at from auth.users where last_sign_in_at is not null
    union all select id, last_seen_at from public.profiles where last_seen_at is not null
  ),
  last_act as (select user_id, max(at) as at from act group by user_id),
  ev as (select * from public.app_events where created_at >= since),
  mv as (select * from public.movements where created_at >= since),
  series as (
    select g::date as day,
      (select count(distinct a.user_id) from act a where a.at >= g at time zone tz and a.at < (g + interval '1 day') at time zone tz) as active,
      (select count(*) from public.movements m where m.created_at >= g at time zone tz and m.created_at < (g + interval '1 day') at time zone tz) as movements,
      (select count(*) from auth.users u where u.created_at >= g at time zone tz and u.created_at < (g + interval '1 day') at time zone tz) as signups,
      (select count(*) from ev e where e.created_at >= g at time zone tz and e.created_at < (g + interval '1 day') at time zone tz) as events
    from generate_series((since at time zone tz)::date::timestamp, (now() at time zone tz)::date::timestamp, interval '1 day') g
  ),
  perf as (
    select props ->> 'metric' as metric, count(*) as n,
      round(avg((props ->> 'ms')::numeric)) as avg_ms,
      round(percentile_cont(0.5) within group (order by (props ->> 'ms')::numeric)::numeric) as p50,
      round(percentile_cont(0.95) within group (order by (props ->> 'ms')::numeric)::numeric) as p95
    from ev where name = 'perf' and props ? 'ms' and (props ->> 'ms') ~ '^[0-9.]+$'
    group by 1
  ),
  users as (
    select p.id, p.email, p.full_name, p.role, p.created_at, la.at as last_active,
      (select count(*) from public.movements m where m.user_id = p.id) as movements,
      (select count(*) from mv m where m.user_id = p.id) as movements_period,
      (select count(*) from public.goals g where g.user_id = p.id) as goals,
      (select count(*) from public.category_limits l where l.user_id = p.id) as limits,
      (select count(*) from ev e where e.user_id = p.id) as events_period,
      (select count(distinct e.session_id) from ev e where e.user_id = p.id and e.name = 'app_open') as sessions_period,
      (select e.screen from ev e where e.user_id = p.id and e.name = 'screen_view' and e.screen is not null
         group by e.screen order by count(*) desc limit 1) as top_screen,
      (select e.platform from public.app_events e where e.user_id = p.id and e.platform is not null order by e.created_at desc limit 1) as platform,
      exists (select 1 from public.push_subscriptions s where s.user_id = p.id) as push,
      st.split, st.cycle, coalesce(st.onboarded, false) as onboarded
    from public.profiles p
    left join last_act la on la.user_id = p.id
    left join public.user_settings st on st.user_id = p.id
  )
  select jsonb_build_object(
    'generated_at', now(),
    'days', d,
    'kpis', jsonb_build_object(
      'users', (select count(*) from public.profiles),
      'admins', (select count(*) from public.profiles where role = 'admin'),
      'new_users', (select count(*) from auth.users where created_at >= since),
      'dau', (select count(distinct user_id) from act where at >= today),
      'wau', (select count(distinct user_id) from act where at >= now() - interval '7 days'),
      'mau', (select count(distinct user_id) from act where at >= now() - interval '30 days'),
      'movements_total', (select count(*) from public.movements),
      'movements_period', (select count(*) from mv),
      'movements_today', (select count(*) from public.movements where created_at >= today),
      'goals_total', (select count(*) from public.goals),
      'push_users', (select count(distinct user_id) from public.push_subscriptions),
      'onboarded', (select count(*) from public.user_settings where onboarded),
      'sessions_period', (select count(distinct session_id) from ev where name = 'app_open'),
      'events_period', (select count(*) from ev),
      'errors_period', (select count(*) from ev where name = 'error'),
      'inactive_14d', (select count(*) from public.profiles p left join last_act la on la.user_id = p.id
                        where la.at is null or la.at < now() - interval '14 days')
    ),
    'series', coalesce((select jsonb_agg(to_jsonb(series) order by day) from series), '[]'::jsonb),
    'by_kind', coalesce((select jsonb_object_agg(kind, n) from (select kind, count(*) n from mv group by kind) x), '{}'::jsonb),
    'by_source', coalesce((select jsonb_object_agg(source, n) from (select coalesce(source, 'app') source, count(*) n from mv group by 1) x), '{}'::jsonb),
    'by_freq', coalesce((select jsonb_object_agg(freq, n) from (select freq, count(*) n from mv group by freq) x), '{}'::jsonb),
    'top_categories', coalesce((select jsonb_agg(x order by n desc) from (
        select coalesce(cat, 'Ingreso') as cat, count(*) n, count(distinct user_id) users from mv group by 1 order by 2 desc limit 12) x), '[]'::jsonb),
    'with_note_pct', (select case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where coalesce(note, '') <> '') / count(*)) end from mv),
    'splits', coalesce((select jsonb_object_agg(split, n) from (select split, count(*) n from public.user_settings group by split) x), '{}'::jsonb),
    'cycles', coalesce((select jsonb_object_agg(cycle, n) from (select cycle, count(*) n from public.user_settings group by cycle) x), '{}'::jsonb),
    'screens', coalesce((select jsonb_agg(x order by views desc) from (
        select screen, count(*) views, count(distinct user_id) users from ev where name = 'screen_view' and screen is not null group by screen) x), '[]'::jsonb),
    'actions', coalesce((select jsonb_agg(x order by n desc) from (
        select name, count(*) n, count(distinct user_id) users from ev
        where name not in ('screen_view', 'perf', 'error', 'app_open') group by name order by 2 desc limit 20) x), '[]'::jsonb),
    'hours', coalesce((select jsonb_agg(x order by hour) from (
        select h as hour, (select count(*) from act a where a.at >= since and extract(hour from a.at at time zone tz) = h) n
        from generate_series(0, 23) h) x), '[]'::jsonb),
    'platforms', coalesce((select jsonb_agg(x order by users desc) from (
        select platform, count(distinct user_id) users, count(distinct session_id) sessions from ev
        where name = 'app_open' and platform is not null group by platform) x), '[]'::jsonb),
    'perf', coalesce((select jsonb_agg(to_jsonb(perf) order by metric) from perf), '[]'::jsonb),
    'errors', coalesce((select jsonb_agg(x) from (
        select e.created_at, e.screen, e.platform, left(e.props ->> 'message', 200) as message, p.email
        from ev e left join public.profiles p on p.id = e.user_id
        where e.name = 'error' order by e.created_at desc limit 15) x), '[]'::jsonb),
    'users', coalesce((select jsonb_agg(to_jsonb(users) order by last_active desc nulls last) from users), '[]'::jsonb)
  ) into result;
  return result;
end $$;

revoke all on function public.admin_dashboard(int) from public, anon;
grant execute on function public.admin_dashboard(int) to authenticated;
revoke all on function public.admin_set_role(uuid, public.app_role) from public, anon;
grant execute on function public.admin_set_role(uuid, public.app_role) to authenticated;
revoke all on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_user_updated() from public, anon, authenticated;

-- Aplicado después: is_admin() no es ejecutable sin sesión
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
