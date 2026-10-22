-- Ya aplicado en tu proyecto (respaldo). Solo agrega columnas; no borra ni cambia datos existentes.

-- Fin de un pago/ingreso recurrente (así se puede "terminar" sin borrar su historial)
alter table public.movements add column if not exists ends_at date;

-- Personalización por usuario
alter table public.user_settings add column if not exists pay_day smallint not null default 1;      -- día en que cobra (0 = domingo ... 6 = sábado)
alter table public.user_settings add column if not exists split text not null default '50-30-20';    -- reparto del presupuesto
alter table public.user_settings add column if not exists onboarded boolean not null default false; -- ya vio el asistente de bienvenida

alter table public.user_settings drop constraint if exists user_settings_pay_day_check;
alter table public.user_settings add constraint user_settings_pay_day_check check (pay_day between 0 and 6);
alter table public.user_settings drop constraint if exists user_settings_split_check;
alter table public.user_settings add constraint user_settings_split_check check (split in ('50-30-20','60-20-20','70-20-10','40-30-30'));

-- Las cuentas que ya existían no necesitan el asistente inicial
update public.user_settings set onboarded = true;
