import { DAY_MS, daysIn, endOfDay, midnight, periodEnd, periodStart, startOfMonth } from './dates';
import { BUCKETS } from '../constants/budget';
import { asExp, bucketOf, occurrences, report } from './finance';
import { money } from './format';

// Cálculos que usan las pantallas (separados de la interfaz para poder reutilizarlos y probarlos)

// Resumen del periodo (semana, quincena o mes): del inicio hasta hoy, solo lo ya registrado
export function homeSummary(moves, limits, period, now = new Date()) {
  const start = periodStart(period, now);
  const cur = report(moves, start, now);
  const { income, spent, total: totalSpent } = cur;
  const totalDays = Math.round((periodEnd(period, start) - start) / DAY_MS) + 1;
  const elapsed = Math.round((midnight(now) - start) / DAY_MS) + 1;
  const daysLeft = Math.max(totalDays - elapsed + 1, 1);
  const end = periodEnd(period, start);
  // Ritmo: se mide contra Necesidades + Deseos (el 80%), porque el Ahorro (20%) es una meta, no un gasto a frenar
  const flexSpent = spent.needs + spent.wants;
  const flexBudget = (income * (BUCKETS.needs.pct + BUCKETS.wants.pct)) / 100;
  const pending = pendingFixed(moves, now, end);
  const flexLeft = flexBudget - flexSpent - pending;
  const monthByCat = report(moves, startOfMonth(now), now).byCat;
  const limitRows = Object.entries(limits)
    .map(([cat, lim]) => [cat, lim, monthByCat[cat] || 0])
    .sort((x, y) => y[2] / y[1] - x[2] / x[1]);
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prev = period === 'monthly'
    ? report(moves, prevMonth, endOfDay(new Date(prevMonth.getFullYear(), prevMonth.getMonth(), Math.min(now.getDate(), daysIn(prevMonth.getFullYear(), prevMonth.getMonth())))))
    : null;
  return {
    now, start, end, cur, income, spent, totalSpent, limitRows, prev, totalDays, elapsed, daysLeft,
    flexSpent, flexBudget, pending, flexLeft,
    flexPct: flexBudget > 0 ? Math.round((flexSpent / flexBudget) * 100) : 0,
    perDay: Math.max(flexLeft, 0) / daysLeft,
    timePct: Math.round((elapsed / totalDays) * 100),
    spentPct: income > 0 ? Math.round((totalSpent / income) * 100) : 0,
    upcoming: upcomingPayments(moves, now, 7),
    topCats: Object.entries(cur.byCat).sort((x, y) => y[1] - x[1]).slice(0, 3),
  };
}

// Pagos fijos (recurrentes, sin contar Ahorro) que aún faltan por cobrarse hasta el fin del periodo
export function pendingFixed(moves, now, end) {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (tomorrow > end) return 0;
  return moves
    .filter((m) => m.kind === 'expense' && m.freq && m.freq !== 'once' && bucketOf(m.cat) !== 'savings')
    .reduce((sum, m) => sum + m.amount * occurrences(asExp(m), tomorrow, end), 0);
}

// Gastos recurrentes que vencen en los próximos N días
export function upcomingPayments(moves, now, days) {
  const out = [];
  const recurring = moves.filter((m) => m.kind === 'expense' && m.freq && m.freq !== 'once');
  for (let i = 1; i <= days; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    recurring.forEach((m) => { if (occurrences(asExp(m), d, d) > 0) out.push({ m, d }); });
  }
  return out;
}

// Promedio mensual en Necesidades (últimos 3 meses con datos); base de la meta de fondo de emergencia
export function monthlyNeedsAverage(moves, now = new Date()) {
  const vals = [];
  for (let k = 1; k <= 3; k++) {
    const from = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const v = report(moves, from, endOfDay(new Date(from.getFullYear(), from.getMonth() + 1, 0))).spent.needs;
    if (v > 0) vals.push(v);
  }
  if (vals.length) return vals.reduce((a, b) => a + b, 0) / vals.length;
  return report(moves, startOfMonth(now), now).spent.needs;
}

// Aviso al acercarse o pasar el límite mensual de una categoría
export function limitMessage(cat, total, limit) {
  if (total >= limit) return '⚠️ Superaste tu límite de ' + cat + ' (' + money(total) + ' de ' + money(limit) + ').';
  if (total >= limit * 0.8) return 'Vas en ' + Math.round((total / limit) * 100) + '% de tu límite de ' + cat + '.';
  return '';
}
