import { CATS, DAYS } from '../constants/budget';
import { daysIn, midnight, nextDay } from './dates';

// Cuántas veces ocurre un gasto entre from y to (los recurrentes cuentan desde el día en que se crearon)
export function occurrences(e, from, to) {
  const f = e.freq || 'once', st = midnight(new Date(e.date));
  if (f === 'once') { const d = new Date(e.date); return d >= from && d <= to ? 1 : 0; }
  let n = 0;
  for (let d = new Date(Math.max(from, st)); d <= to; d = nextDay(d)) {
    if (f === 'weekly' && d.getDay() === e.day) n++;
    else if (f === 'biweekly' && Math.round((d - st) / 864e5) % 14 === 0) n++;
    else if (f === 'monthly' && d.getDate() === Math.min(e.day, daysIn(d.getFullYear(), d.getMonth()))) n++;
    else if (f === 'yearly' && d.getMonth() === st.getMonth() && d.getDate() === st.getDate()) n++;
  }
  return n;
}

export function freqLabel(e) {
  const f = e.freq || 'once';
  if (f === 'weekly') return 'Cada ' + DAYS[e.day];
  if (f === 'biweekly') return 'Cada 2 semanas';
  if (f === 'monthly') return 'Mensual · día ' + e.day;
  if (f === 'yearly') return 'Anual';
  return new Date(e.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

export const asExp = (m) => ({ freq: m.freq, day: m.day, date: m.occurred_at });

export const bucketOf = (cat) => (CATS.find((c) => c.name === cat) || { bucket: 'wants' }).bucket;

export function report(moves, from, to) {
  const spent = { needs: 0, wants: 0, savings: 0 }, byCat = {}, rows = [];
  let income = 0;
  moves.forEach((m) => {
    if (m.kind === 'income') {
      const d = new Date(m.occurred_at);
      if (d >= from && d <= to) { income += m.amount; rows.push({ m, amount: m.amount, label: 'Ingreso' }); }
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
