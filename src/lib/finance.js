import { CATS, DAYS } from '../constants/budget';
import { daysIn, midnight, nextDay } from './dates';

// 'YYYY-MM-DD' (columna date de Supabase) -> fecha local a medianoche
export const parseDay = (str) => { const [y, m, d] = String(str).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };

export const isRecurring = (m) => !!m.freq && m.freq !== 'once';

// Un pago/ingreso recurrente sigue vigente si no tiene fecha de fin o ésta aún no llega
export const isActive = (m, now = new Date()) => !m.ends_at || parseDay(m.ends_at) >= midnight(now);

// Cuántas veces ocurre un movimiento entre from y to (los recurrentes cuentan desde el día en que se crearon hasta su fecha de fin, si la tienen)
export function occurrences(e, from, to) {
  const f = e.freq || 'once', st = midnight(new Date(e.date));
  if (f === 'once') { const d = new Date(e.date); return d >= from && d <= to ? 1 : 0; }
  const last = e.ends ? parseDay(e.ends) : null;
  const stop = last && last < to ? last : to;
  let n = 0;
  for (let d = new Date(Math.max(from, st)); d <= stop; d = nextDay(d)) {
    if (f === 'weekly' && d.getDay() === e.day) n++;
    else if (f === 'biweekly' && Math.round((d - st) / 864e5) % 14 === 0) n++;
    else if (f === 'monthly' && d.getDate() === Math.min(e.day, daysIn(d.getFullYear(), d.getMonth()))) n++;
    else if (f === 'yearly' && d.getMonth() === st.getMonth() && d.getDate() === st.getDate()) n++;
  }
  return n;
}

// Fechas (a medianoche) en que ocurre un movimiento entre from y to
export function occurrenceDates(e, from, to) {
  const f = e.freq || 'once', st = midnight(new Date(e.date));
  if (f === 'once') { const d = midnight(new Date(e.date)); return d >= midnight(from) && d <= to ? [d] : []; }
  const last = e.ends ? parseDay(e.ends) : null;
  const stop = last && last < to ? last : to;
  const out = [];
  for (let d = new Date(Math.max(midnight(from), st)); d <= stop; d = nextDay(d)) {
    if (occurrences(e, d, endOfDayLocal(d)) > 0) out.push(d);
  }
  return out;
}
const endOfDayLocal = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

// Gastos fijos que cubren varias semanas (la renta, o lo que se paga cada mes o cada año).
// En la vista semanal/quincenal se reparten entre los días que cubren para no distorsionar la semana en que se pagan.
const COVER_DAYS = { once: 30, biweekly: 14, monthly: 30, yearly: 365 };
export function isSpreadable(m) {
  if (m.kind !== 'expense' || bucketOf(m.cat) === 'savings') return false;
  const f = m.freq || 'once';
  if (m.cat === 'Renta') return f !== 'weekly';
  return f === 'monthly' || f === 'yearly';
}

// Parte de los gastos fijos que le corresponde a los días entre from y to, por bucket
export function spreadSpent(moves, from, to) {
  const spent = { needs: 0, wants: 0, savings: 0 };
  const a = midnight(from), b = midnight(to);
  moves.forEach((m) => {
    const cover = COVER_DAYS[m.freq || 'once'];
    if (!cover) return;
    const windowStart = new Date(a.getFullYear(), a.getMonth(), a.getDate() - (cover - 1));
    occurrenceDates(asExp(m), windowStart, endOfDayLocal(b)).forEach((d) => {
      const last = new Date(d.getFullYear(), d.getMonth(), d.getDate() + cover - 1);
      const lo = d > a ? d : a, hi = last < b ? last : b;
      const days = Math.round((hi - lo) / 864e5) + 1;
      if (days > 0) spent[bucketOf(m.cat)] += (m.amount * days) / cover;
    });
  });
  return spent;
}

export function freqLabel(e) {
  const f = e.freq || 'once';
  const ended = e.ends ? ' · terminó el ' + parseDay(e.ends).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '';
  if (f === 'weekly') return 'Cada ' + DAYS[e.day] + ended;
  if (f === 'biweekly') return 'Cada 2 semanas' + ended;
  if (f === 'monthly') return 'Mensual · día ' + e.day + ended;
  if (f === 'yearly') return 'Anual' + ended;
  return new Date(e.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

export const asExp = (m) => ({ freq: m.freq, day: m.day, date: m.occurred_at, ends: m.ends_at });

export const bucketOf = (cat) => (CATS.find((c) => c.name === cat) || { bucket: 'wants' }).bucket;

export function report(moves, from, to) {
  const spent = { needs: 0, wants: 0, savings: 0 }, byCat = {}, rows = [];
  let income = 0;
  moves.forEach((m) => {
    if (m.kind === 'income') {
      if (!isRecurring(m)) {
        const d = new Date(m.occurred_at);
        if (d >= from && d <= to) { income += m.amount; rows.push({ m, amount: m.amount, label: 'Ingreso' }); }
        return;
      }
      // Ingreso recurrente (nómina): cuenta cada vez que toca
      const k = occurrences(asExp(m), from, to);
      if (k > 0) { income += m.amount * k; rows.push({ m, amount: m.amount * k, label: (k > 1 ? k + ' veces · ' : '') + freqLabel(asExp(m)) }); }
      return;
    }
    const n = occurrences(asExp(m), from, to);
    if (n > 0) {
      const amt = m.amount * n;
      spent[bucketOf(m.cat)] += amt; byCat[m.cat] = (byCat[m.cat] || 0) + amt;
      rows.push({ m, amount: -amt, label: (n > 1 ? n + ' veces · ' : '') + freqLabel(asExp(m)) });
    }
  });
  return { income, spent, byCat, rows, total: spent.needs + spent.wants + spent.savings };
}
