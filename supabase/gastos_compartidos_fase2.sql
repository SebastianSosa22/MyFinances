-- Gastos compartidos, fase 2: compartir con otros usuarios de la app.
-- Solo agrega tablas, columnas y funciones; no cambia ni borra datos existentes.
--
-- Cómo funciona:
-- 1) En la fase 1 las personas de un gasto son nombres dentro de movements.split. Para conectar un nombre con una cuenta real,
--    el dueño crea un contacto (shared_contacts) con ese nombre y comparte su link de invitación (?invitacion=<código>).
-- 2) Quien abre el link inicia sesión y acepta (accept_shared_invite): su cuenta queda ligada a ese nombre y se le crea
--    el contacto de regreso (con el nombre del dueño), así los dos se ven.
-- 3) shared_with_me() le muestra a cada usuario los gastos de otros donde aparece su nombre ligado, sin abrirle la tabla movements.
-- 4) mark_shared_paid() deja que la otra persona marque lo saldado en el gasto del dueño (solo lo de ella).
-- 5) Avisos push: un trigger anota en shared_events cuando te agregan a un gasto o te marcan un pago, y llama a la función
--    send-shared-push para enviarlos al momento.

-- Contactos de cada usuario: nombre que usa en sus gastos y, si ya aceptó, la cuenta ligada ----------------------------
create table if not exists public.shared_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  invite_code text unique check (invite_code is null or char_length(invite_code) between 16 and 64),
  linked_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (owner_id, name),
  check (linked_user_id is null or linked_user_id <> owner_id)
);
create unique index if not exists shared_contacts_owner_linked on public.shared_contacts (owner_id, linked_user_id) where linked_user_id is not null;
create index if not exists shared_contacts_linked_idx on public.shared_contacts (linked_user_id);
alter table public.shared_contacts enable row level security;
revoke all on public.shared_contacts from anon;
create policy shared_contacts_select_own on public.shared_contacts for select to authenticated using (owner_id = (select auth.uid()));
-- Al crear un contacto no se puede ligar una cuenta a mano: eso solo pasa al aceptar la invitación
create policy shared_contacts_insert_own on public.shared_contacts for insert to authenticated
  with check (owner_id = (select auth.uid()) and linked_user_id is null and accepted_at is null);
create policy shared_contacts_delete_own on public.shared_contacts for delete to authenticated using (owner_id = (select auth.uid()));
revoke update on public.shared_contacts from authenticated;

-- Gasto propio creado a partir de uno compartido contigo (para no agregarlo dos veces a tu presupuesto) -----------------
alter table public.movements add column if not exists shared_from uuid;

-- Cola de avisos push (bloqueada: solo la leen el trigger y la función del servidor) -------------------------------------
create table if not exists public.shared_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists shared_events_pending on public.shared_events (created_at) where sent_at is null;
alter table public.shared_events enable row level security;
revoke all on public.shared_events from anon, authenticated;

-- Nombre corto de una cuenta (primer nombre o lo que va antes de la @) -----------------------------------------------------
create or replace function public.display_name_of(uid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select left(coalesce(nullif(split_part(trim(u.raw_user_meta_data ->> 'full_name'), ' ', 1), ''), nullif(split_part(trim(u.raw_user_meta_data ->> 'name'), ' ', 1), ''), split_part(u.email, '@', 1), 'Alguien'), 24)
  from auth.users u where u.id = uid;
$$;
revoke all on function public.display_name_of(uuid) from public, anon, authenticated;

-- Crear (o reusar) el link de invitación para una persona de tus gastos ------------------------------------------------------
create or replace function public.create_shared_invite(person text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  nm text := trim(person);
  c public.shared_contacts;
  code text := replace(gen_random_uuid()::text, '-', '');
begin
  if me is null then raise exception 'Inicia sesión'; end if;
  if nm is null or char_length(nm) not between 1 and 24 or nm = 'Tú' then raise exception 'Nombre no válido'; end if;
  select * into c from public.shared_contacts where owner_id = me and name = nm for update;
  if found then
    if c.linked_user_id is not null then return jsonb_build_object('linked', true); end if;
    if c.invite_code is not null then return jsonb_build_object('code', c.invite_code); end if;
    update public.shared_contacts set invite_code = code where id = c.id;
  else
    if (select count(*) from public.shared_contacts where owner_id = me) >= 200 then raise exception 'Demasiados contactos'; end if;
    insert into public.shared_contacts (owner_id, name, invite_code) values (me, nm, code);
  end if;
  return jsonb_build_object('code', code);
end $$;
revoke all on function public.create_shared_invite(text) from public, anon;
grant execute on function public.create_shared_invite(text) to authenticated;

-- Ver una invitación antes de aceptarla -------------------------------------------------------------------------------------
create or replace function public.shared_invite_info(code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.shared_contacts;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para ver la invitación'; end if;
  select * into c from public.shared_contacts where invite_code = code;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if c.owner_id = auth.uid() then return jsonb_build_object('ok', false, 'reason', 'own'); end if;
  if c.linked_user_id is not null then return jsonb_build_object('ok', false, 'reason', 'used'); end if;
  return jsonb_build_object('ok', true, 'from', public.display_name_of(c.owner_id), 'as', c.name);
end $$;
revoke all on function public.shared_invite_info(text) from public, anon;
grant execute on function public.shared_invite_info(text) to authenticated;

-- Aceptar: liga tu cuenta al nombre que usa quien te invitó y te crea el contacto de regreso --------------------------------
create or replace function public.accept_shared_invite(code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  c public.shared_contacts;
  back_name text;
  n int := 1;
begin
  if me is null then raise exception 'Inicia sesión para aceptar la invitación'; end if;
  select * into c from public.shared_contacts where invite_code = code for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if c.owner_id = me then return jsonb_build_object('ok', false, 'reason', 'own'); end if;
  if c.linked_user_id is not null then return jsonb_build_object('ok', false, 'reason', 'used'); end if;
  if exists (select 1 from public.shared_contacts where owner_id = c.owner_id and linked_user_id = me) then
    return jsonb_build_object('ok', false, 'reason', 'already');
  end if;
  update public.shared_contacts set linked_user_id = me, accepted_at = now(), invite_code = null where id = c.id;
  -- Contacto de regreso (si no existe ya): con el nombre del dueño; si ya usas ese nombre para alguien más, se numera
  if not exists (select 1 from public.shared_contacts where owner_id = me and linked_user_id = c.owner_id) then
    back_name := public.display_name_of(c.owner_id);
    if exists (select 1 from public.shared_contacts where owner_id = me and name = back_name and linked_user_id is null) then
      update public.shared_contacts set linked_user_id = c.owner_id, accepted_at = now(), invite_code = null
        where owner_id = me and name = back_name and linked_user_id is null;
    else
      while exists (select 1 from public.shared_contacts where owner_id = me and name = back_name) loop
        n := n + 1; back_name := left(public.display_name_of(c.owner_id), 21) || ' ' || n;
      end loop;
      insert into public.shared_contacts (owner_id, name, linked_user_id, accepted_at) values (me, back_name, c.owner_id, now());
    end if;
  end if;
  insert into public.shared_events (user_id, title, body)
    values (c.owner_id, public.display_name_of(me) || ' aceptó tu invitación', 'Ya puede ver los gastos que compartes con ' || c.name || '.');
  perform public.ping_shared_push();
  return jsonb_build_object('ok', true, 'from', public.display_name_of(c.owner_id));
end $$;
revoke all on function public.accept_shared_invite(text) from public, anon;
grant execute on function public.accept_shared_invite(text) to authenticated;

-- Gastos de otros donde apareces (por el nombre con que te ligaron). No incluye la cuenta bancaria del dueño. ---------------
create or replace function public.shared_with_me() returns table (
  id uuid, owner_name text, my_name text, note text, cat text, amount numeric, freq text, day smallint,
  occurred_at timestamptz, ends_at date, split jsonb
)
language sql stable security definer set search_path = '' as $$
  select m.id,
         coalesce((select b.name from public.shared_contacts b where b.owner_id = (select auth.uid()) and b.linked_user_id = m.user_id limit 1), public.display_name_of(m.user_id)),
         c.name, m.note, m.cat, m.amount, m.freq, m.day, m.occurred_at, m.ends_at, m.split
  from public.shared_contacts c
  join public.movements m on m.user_id = c.owner_id
  where c.linked_user_id = (select auth.uid())
    and m.kind = 'expense' and m.split is not null
    and (m.split -> 'people' @> jsonb_build_array(jsonb_build_object('name', c.name)) or m.split ->> 'payer' = c.name)
  order by m.occurred_at desc
  limit 500;
$$;
revoke all on function public.shared_with_me() from public, anon;
grant execute on function public.shared_with_me() to authenticated;

-- Marcar como saldado (o pendiente) lo tuyo en un gasto de otra persona -----------------------------------------------------
-- Si el dueño pagó: marcas que ya le pagaste tu parte. Si tú pagaste: marcas que el dueño ya te pagó la suya.
create or replace function public.mark_shared_paid(movement uuid, keys text[], paid boolean default true) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  m public.movements;
  c public.shared_contacts;
  sp jsonb;
  people jsonb := '[]'::jsonb;
  p jsonb;
  list jsonb;
  found_me boolean := false;
  share numeric := 0;
  k text;
begin
  if me is null then raise exception 'Inicia sesión'; end if;
  if keys is null or array_length(keys, 1) is null or array_length(keys, 1) > 400 then raise exception 'Fechas no válidas'; end if;
  foreach k in array keys loop
    if k !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Fecha no válida'; end if;
  end loop;
  select * into m from public.movements where id = movement for update;
  if not found or m.split is null then return false; end if;
  select * into c from public.shared_contacts where owner_id = m.user_id and linked_user_id = me;
  if not found then return false; end if;
  sp := m.split;
  if coalesce(sp ->> 'payer', 'Tú') = 'Tú' then
    for p in select * from jsonb_array_elements(sp -> 'people') loop
      if p ->> 'name' = c.name then
        found_me := true; share := coalesce((p ->> 'share')::numeric, 0);
        if paid then
          select coalesce(jsonb_agg(distinct x), '[]'::jsonb) into list from (select jsonb_array_elements_text(coalesce(p -> 'paid', '[]'::jsonb)) as x union select unnest(keys)) t;
        else
          select coalesce(jsonb_agg(x), '[]'::jsonb) into list from jsonb_array_elements_text(coalesce(p -> 'paid', '[]'::jsonb)) x where x <> all (keys);
        end if;
        p := jsonb_set(p, '{paid}', list);
      end if;
      people := people || jsonb_build_array(p);
    end loop;
    if not found_me then return false; end if;
    sp := jsonb_set(sp, '{people}', people);
  elsif sp ->> 'payer' = c.name then
    share := m.amount;
    if paid then
      select coalesce(jsonb_agg(distinct x), '[]'::jsonb) into list from (select jsonb_array_elements_text(coalesce(sp -> 'mine_paid', '[]'::jsonb)) as x union select unnest(keys)) t;
    else
      select coalesce(jsonb_agg(x), '[]'::jsonb) into list from jsonb_array_elements_text(coalesce(sp -> 'mine_paid', '[]'::jsonb)) x where x <> all (keys);
    end if;
    sp := jsonb_set(sp, '{mine_paid}', list);
  else
    return false;
  end if;
  update public.movements set split = sp where id = m.id;
  if paid then
    insert into public.shared_events (user_id, title, body) values (m.user_id,
      case when coalesce(m.split ->> 'payer', 'Tú') = 'Tú' then c.name || ' marcó que ya te pagó' else c.name || ' marcó que ya le pagaste' end,
      coalesce(nullif(m.note, ''), m.cat, 'Gasto compartido') || ' · ' || to_char(share * array_length(keys, 1), 'FM$999,999,990.00'));
    perform public.ping_shared_push();
  end if;
  return true;
end $$;
revoke all on function public.mark_shared_paid(uuid, text[], boolean) from public, anon;
grant execute on function public.mark_shared_paid(uuid, text[], boolean) to authenticated;

-- Llama a la función que envía los avisos (no espera la respuesta; si falla, el siguiente aviso los vuelve a intentar) -------
create or replace function public.ping_shared_push() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://yphvecfopkaifhkndaru.supabase.co/functions/v1/send-shared-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select value from public.app_secrets where key = 'cron_secret')),
    body := '{}'::jsonb
  );
exception when others then null; -- un aviso nunca debe impedir guardar un gasto
end $$;
revoke all on function public.ping_shared_push() from public, anon, authenticated;

-- Aviso a las personas ligadas cuando las agregan a un gasto (o cuando aparece un gasto que pagaron ellas) -------------------
create or replace function public.notify_shared_added() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  owner text;
  what text;
  before_names text[] := '{}';
  total numeric;
  any_new boolean := false;
begin
  if new.kind <> 'expense' or new.split is null or jsonb_typeof(new.split -> 'people') <> 'array' then return new; end if;
  if tg_op = 'UPDATE' and old.split is not null and jsonb_typeof(old.split -> 'people') = 'array' then
    select coalesce(array_agg(x ->> 'name'), '{}') into before_names from jsonb_array_elements(old.split -> 'people') x;
  end if;
  owner := public.display_name_of(new.user_id);
  what := coalesce(nullif(new.note, ''), new.cat, 'un gasto');
  total := coalesce((new.split ->> 'total')::numeric, new.amount);
  for c in
    select sc.linked_user_id, sc.name, (x ->> 'share')::numeric as share
    from jsonb_array_elements(new.split -> 'people') x
    join public.shared_contacts sc on sc.owner_id = new.user_id and sc.name = x ->> 'name' and sc.linked_user_id is not null
    where not ((x ->> 'name') = any (before_names))
  loop
    any_new := true;
    insert into public.shared_events (user_id, title, body) values (c.linked_user_id,
      owner || ' te agregó a un gasto compartido',
      what || ' · total ' || to_char(total, 'FM$999,999,990.00') || '. ' ||
      case when coalesce(new.split ->> 'payer', 'Tú') = 'Tú' then 'Te toca ' || to_char(c.share, 'FM$999,999,990.00') || '.'
           when new.split ->> 'payer' = c.name then 'Pagaste tú: ' || owner || ' te debe ' || to_char(new.amount, 'FM$999,999,990.00') || '.'
           else 'Te toca ' || to_char(c.share, 'FM$999,999,990.00') || '.' end);
  end loop;
  if any_new then perform public.ping_shared_push(); end if;
  return new;
exception when others then
  return new; -- un aviso nunca debe impedir guardar un gasto
end $$;
revoke all on function public.notify_shared_added() from public, anon, authenticated;
drop trigger if exists movements_shared_notify on public.movements;
create trigger movements_shared_notify after insert or update of split on public.movements
  for each row execute function public.notify_shared_added();
