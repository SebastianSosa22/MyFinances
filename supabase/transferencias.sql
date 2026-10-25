-- Ya aplicado en tu proyecto (respaldo). Solo agrega una tabla; no borra ni cambia datos existentes.

-- Dinero que se mueve entre tus cuentas sin ser gasto ni ingreso (no cuenta en presupuestos ni reportes):
--   kind = 'transfer': de una cuenta a otra (por ejemplo, pagar la tarjeta de crédito desde el débito).
--   kind = 'adjust':   corrección del saldo para que coincida con el banco. Solo lleva una cuenta:
--                      to_account_id si el saldo sube (o la deuda baja), from_account_id si el saldo baja (o la deuda sube).
create table if not exists public.account_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'transfer' check (kind in ('transfer','adjust')),
  from_account_id uuid references public.money_accounts(id) on delete cascade,
  to_account_id uuid references public.money_accounts(id) on delete cascade,
  amount numeric not null check (amount > 0),
  note text check (char_length(note) <= 80),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint account_transfers_sides check (
    (kind = 'transfer' and from_account_id is not null and to_account_id is not null and from_account_id <> to_account_id)
    or (kind = 'adjust' and (from_account_id is null) <> (to_account_id is null))
  )
);
create index if not exists account_transfers_user_idx on public.account_transfers (user_id);
create index if not exists account_transfers_from_idx on public.account_transfers (from_account_id);
create index if not exists account_transfers_to_idx on public.account_transfers (to_account_id);

alter table public.account_transfers enable row level security;

-- Solo se puede mover dinero entre cuentas propias
create or replace function public.owns_account(acc uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select acc is null or exists (select 1 from public.money_accounts a where a.id = acc and a.user_id = (select auth.uid()));
$$;

create policy "account_transfers_select_own" on public.account_transfers for select to authenticated using (user_id = (select auth.uid()));
create policy "account_transfers_insert_own" on public.account_transfers for insert to authenticated
  with check (user_id = (select auth.uid()) and public.owns_account(from_account_id) and public.owns_account(to_account_id));
create policy "account_transfers_update_own" on public.account_transfers for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_account(from_account_id) and public.owns_account(to_account_id));
create policy "account_transfers_delete_own" on public.account_transfers for delete to authenticated using (user_id = (select auth.uid()));
