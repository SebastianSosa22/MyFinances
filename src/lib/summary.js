import { DAY_MS, daysIn, endOfDay, midnight, periodEnd, periodStart, startOfMonth } from './dates';
import { BUCKETS } from '../constants/budget';
import { asExp, bucketOf, isRecurring, isSpreadable, isSpreadableIncome, occurrences, report, spreadSpent } from './finance';
import { money } from './format';

// Cálculos que usan las pantallas (separados de la interfaz para poder reutilizarlos y probarlos)

// Resumen del periodo (semana, quincena o mes): del inicio hasta hoy, solo lo ya registrado
export function homeSummary(moves, limits, period, now = new Date(), payDay = 1) {
  const start = periodStart(period, now, payDay);
  const end = periodEnd(period, start);
  const cur = report(moves, start, now);
  const { income, total: totalSpent } = cur;
  const totalDays = Math.round((end - start) / DAY_MS) + 1;
  const elapsed = Math.round((midnight(now) - start) / DAY_MS) + 1;
  const daysLeft = Math.max(totalDays - elapsed + 1, 1);
  // Ritmo: se mide contra Necesidades + Deseos (lo que queda tras apartar el % de ahorro), porque el Ahorro es una meta, no un gasto a frenar
  const flexBudget = (income * (BUCKETS.needs.pct + BUCKETS.wants.pct)) / 100;
  const pending = pendingFixed(moves, now, end);

  // 1) Efectivo real: lo que ya salió de tu bolsillo en este periodo
  const flexLeftCash = flexBudget - (cur.spent.needs + cur.spent.wants) - pending;
  const oneOffAll = report(moves.filter((m) => m.kind === 'income' || !isRecurring(m)), start, now).spent;
  const projCash = (cur.spent.needs + cur.spent.wants) + pending + ((oneOffAll.needs + oneOffAll.wants) / Math.max(elapsed, 1)) * Math.max(totalDays - elapsed, 0);

  // 2) Vista repartida (semana/quincena): la renta y los pagos mensuales/anuales cuentan solo la parte de los días que cubren
  const smooth = period !== 'monthly';
  const fixed = smooth ? moves.filter(isSpreadable) : [];
  let spent = cur.spent, flexLeft = flexLeftCash, projectedFlex = projCash, fixedShare = 0, fixedPaid = 0;
  if (fixed.length) {
    const ids = new Set(fixed.map((m) => m.id));
    const variable = moves.filter((m) => !ids.has(m.id));
    const v = report(variable, start, now).spent;
    const share = spreadSpent(fixed, start, end);
    const vPending = pendingFixed(variable, now, end);
    const vOneOff = report(variable.filter((m) => m.kind === 'income' || !isRecurring(m)), start, now).spent;
    spent = { needs: v.needs + share.needs, wants: v.wants + share.wants, savings: v.savings };
    fixedShare = share.needs + share.wants;
    fixedPaid = report(fixed, start, now).total;
    const flexLeftSmooth = flexBudget - (v.needs + v.wants) - vPending - fixedShare;
    const projSmooth = (v.needs + v.wants) + vPending + fixedShare + ((vOneOff.needs + vOneOff.wants) / Math.max(elapsed, 1)) * Math.max(totalDays - elapsed, 0);
    // Nunca te decimos que tienes más de lo que realmente te queda: tomamos el valor más prudente
    flexLeft = Math.min(flexLeftCash, flexLeftSmooth);
    projectedFlex = Math.max(projCash, projSmooth);
  }
  const flexSpent = spent.needs + spent.wants;
  const viewTotal = spent.needs + spent.wants + spent.savings;

  // Categorías que ya rebasaron su parte del presupuesto (Necesidades o Deseos)
  const overs = income > 0
    ? ['needs', 'wants'].map((k) => ({ k, over: spent[k] - (income * BUCKETS[k].pct) / 100 })).filter((o) => o.over > 0.5)
    : [];

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
    flexSpent, flexBudget, pending, flexLeft, projectedFlex, overs,
    fixedShare, fixedPaid, cashBelowShare: fixed.length > 0 && flexLeftCash < flexLeft + 0.5 && fixedPaid > fixedShare,
    projectedLeft: flexBudget - projectedFlex,
    flexPct: flexBudget > 0 ? Math.round((flexSpent / flexBudget) * 100) : 0,
    perDay: Math.max(flexLeft, 0) / daysLeft,
    timePct: Math.round((elapsed / totalDays) * 100),
    spentPct: income > 0 ? Math.round((viewTotal / income) * 100) : 0,
    upcoming: upcomingPayments(moves, now, 7),
    topCats: Object.entries(cur.byCat).sort((x, y) => y[1] - x[1]).slice(0, 3),
  };
}

// Lo que se guarda (Ahorro e Inversión) sigue siendo tuyo; todo lo demás que sale, deudas incluidas, es gasto
export const KEPT = ['Ahorro', 'Inversión'];
export const keptOf = (byCat) => KEPT.reduce((a, cat) => a + (byCat[cat] || 0), 0);
// Gasto de un reporte sin contar lo guardado
export const outflowOf = (r) => r.total - keptOf(r.byCat);

// Cifras de las tarjetas del Resumen (tarjeta verde, Por pagar y reparto), todas con la misma regla.
// En semana/quincena la renta, los pagos mensuales y la nómina mensual se reparten entre los días que cubren,
// para que la semana en que se pagan no se vea vacía ni desbordada.
export function periodView(moves, period, now = new Date(), payDay = 1) {
  const start = periodStart(period, now, payDay);
  const end = periodEnd(period, start);
  const smooth = period !== 'monthly';
  const spread = smooth ? moves.filter((m) => isSpreadable(m) || isSpreadableIncome(m)) : [];
  const ids = new Set(spread.map((m) => m.id));
  const rest = spread.length ? moves.filter((m) => !ids.has(m.id)) : moves;
  const r = report(rest, start, now);
  const shareOut = spreadSpent(spread.filter((m) => m.kind === 'expense'), start, end);
  const shareIn = spreadSpent(spread.filter((m) => m.kind === 'income'), start, end);
  const income = r.income + shareIn.needs + shareIn.wants + shareIn.savings;
  const spent = { needs: r.spent.needs + shareOut.needs, wants: r.spent.wants + shareOut.wants, savings: r.spent.savings };
  const saved = keptOf(r.byCat);
  const total = spent.needs + spent.wants + spent.savings;
  // "Por pagar" muestra todos los pagos que faltan; "Te quedan" solo descuenta los que no se repartieron,
  // porque la parte del periodo de lo repartido (renta, suscripciones...) ya cuenta en lo gastado
  const pending = pendingBills(moves, now, end);
  const pendingRest = pendingBills(rest, now, end);
  return {
    start, end, income, spent, saved, pending,
    pendingSpread: pending - pendingRest,
    outflow: total - saved,
    left: income - total - pendingRest,
    fixedShare: shareOut.needs + shareOut.wants,
    spentPct: income > 0 ? Math.round((total / income) * 100) : 0,
  };
}

// Saldo acumulado ("Tienes"): todo lo que ha entrado menos todo lo que ha salido hasta hoy.
// Lo enviado a Ahorro o Inversión sigue siendo tuyo, así que se separa como "Ahorro" en lugar de restarse.
export function balanceSummary(moves, now = new Date()) {
  if (!moves.length) return { cash: 0, saved: 0, total: 0 };
  const first = moves.reduce((a, m) => Math.min(a, new Date(m.occurred_at).getTime()), now.getTime());
  const r = report(moves, new Date(first), now);
  const saved = keptOf(r.byCat);
  const cash = r.income - r.total;
  return { cash, saved, total: cash + saved };
}

// Pagos fijos (recurrentes, sin contar Ahorro) que aún faltan por cobrarse hasta el fin del periodo
export function pendingFixed(moves, now, end) {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (tomorrow > end) return 0;
  return moves
    .filter((m) => m.kind === 'expense' && isRecurring(m) && bucketOf(m.cat) !== 'savings')
    .reduce((sum, m) => sum + m.amount * occurrences(asExp(m), tomorrow, end), 0);
}

// Pagos que de verdad salen de tu bolsillo: gastos recurrentes, sin contar lo que mandas a Ahorro o Inversión
const isBill = (m) => m.kind === 'expense' && isRecurring(m) && !KEPT.includes(m.cat);

// "Por pagar": pagos recurrentes que faltan desde mañana hasta el fin del periodo
export function pendingBills(moves, now, end) {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (tomorrow > end) return 0;
  return moves.filter(isBill).reduce((sum, m) => sum + m.amount * occurrences(asExp(m), tomorrow, end), 0);
}

// Pagos recurrentes que vencen en los próximos N días (campana y "Próximos 7 días"; misma regla que "Por pagar")
export function upcomingPayments(moves, now, days) {
  const out = [];
  const recurring = moves.filter(isBill);
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
