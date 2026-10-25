-- Ya aplicado en tu proyecto (respaldo). Solo agrega una tabla y una columna; no borra ni cambia datos existentes.
-- (La tabla antigua public.accounts no se usa y se deja intacta.)

-- Cuentas del usuario: tarjetas de débito, de crédito y efectivo.
-- Nunca se guarda el número completo de la tarjeta, el CVV ni el vencimiento: solo un nombre y, si quiere, los últimos 4 dígitos.
create table if not exists public.money_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  type text not null check (type in ('debit','credit','cash')),
  last4 text check (last4 ~ '^[0-9]{4}$'),
  opening_balance numeric not null default 0,                 -- saldo al registrarla (en crédito: lo que ya debías)
  credit_limit numeric check (credit_limit > 0),              -- solo crédito
  cut_day smallint check (cut_day between 1 and 31),          -- día de corte (crédito)
  due_day smallint check (due_day between 1 and 31),          -- día límite de pago (crédito)
  color text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists money_accounts_user_idx on public.money_accounts (user_id);

alter table public.money_accounts enable row level security;
create policy "money_accounts_select_own" on public.money_accounts for select to authenticated using (user_id = (select auth.uid()));
create policy "money_accounts_insert_own" on public.money_accounts for insert to authenticated with check (user_id = (select auth.uid()));
create policy "money_accounts_update_own" on public.money_accounts for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "money_accounts_delete_own" on public.money_accounts for delete to authenticated using (user_id = (select auth.uid()));

-- Cuenta con la que se hizo cada movimiento (opcional: los movimientos anteriores quedan "Sin cuenta").
-- Si se borra la cuenta, sus movimientos se conservan sin cuenta.
alter table public.movements add column if not exists account_id uuid references public.money_accounts(id) on delete set null;
create index if not exists movements_account_idx on public.movements (account_id);
