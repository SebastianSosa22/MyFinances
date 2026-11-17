-- Gastos compartidos (fase 1, sin cuentas de otros usuarios).
-- En `amount` queda solo TU parte (así el 50/30/20, los límites y los reportes no cambian);
-- `split` guarda el total, quién pagó, cómo se dividió y lo que ya se saldó con cada persona.
-- Forma: { total, payer: 'me' | <nombre>, mode: 'equal' | 'percent' | 'amount',
--          people: [{ name, share, pct?, paid: ['YYYY-MM-DD', ...] }], mine_paid: ['YYYY-MM-DD', ...] }
-- (`paid` y `mine_paid` son las fechas de las veces del gasto ya saldadas; un gasto que se repite tiene una por vez).
alter table public.movements add column if not exists split jsonb;
alter table public.movements
  add constraint movements_split_size check (split is null or (jsonb_typeof(split) = 'object' and pg_column_size(split) <= 4096));
