import { BUCKETS } from '../constants/budget';
import { endOfDay, midnight, startOfMonth } from './dates';
import { report } from './finance';
import { monthlyIncomeEstimate } from './insights';
import { monthlyNeedsAverage } from './summary';

// Salud financiera: una calificación de 0 a 100 hecha con tus propios datos, en el dispositivo.
// Cada factor da de 0 a 1 y pesa lo que dice `w`. Si no hay datos para un factor (sin límites, sin tarjetas...),
// no cuenta y su peso se reparte entre los demás, para no castigarte por algo que no usas.

export const HEALTH_LEVELS = [
  { min: 80, label: 'Excelente', tone: 'good' },
  { min: 60, label: 'Buena', tone: 'ok' },
  { min: 40, label: 'Regular', tone: 'warn' },
  { min: 0, label: 'En riesgo', tone: 'bad' },
];

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const pct = (x) => Math.round(x * 100);
const EMERGENCY_MONTHS = 3;

export function financialHealth(moves, { limits = {}, acc = null, saved = 0, now = new Date() } = {}) {
  // Ventana de 30 días: no se desploma el día 1 del mes ni depende de si cobras semanal o mensual
  const from = midnight(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
  const r = report(moves, from, endOfDay(now));
  const income = r.income;
  if (!(income > 0)) return null;
  const factors = [];

  // 1) Reparto: Necesidades y Deseos dentro de su parte del ingreso (pasarse 50% de su parte deja este punto en 0)
  const part = (k) => {
    const target = (income * BUCKETS[k].pct) / 100;
    const ratio = target > 0 ? r.spent[k] / target : 0;
    return { k, ratio, score: ratio <= 1 ? 1 : clamp01(1 - (ratio - 1) * 2) };
  };
  const parts = [part('needs'), part('wants')];
  const wSum = BUCKETS.needs.pct + BUCKETS.wants.pct;
  const splitScore = parts.reduce((a, p) => a + p.score * BUCKETS[p.k].pct, 0) / wSum;
  const worst = parts.slice().sort((a, b) => b.ratio - a.ratio)[0];
  factors.push({
    key: 'split', label: 'Tu reparto ' + [BUCKETS.needs.pct, BUCKETS.wants.pct, BUCKETS.savings.pct].join('/'), w: 30, score: splitScore,
    detail: worst.ratio > 1 ? BUCKETS[worst.k].label + ' se pasa ' + pct(worst.ratio - 1) + '% de su parte' : 'Necesidades y deseos dentro de su parte',
    tip: worst.ratio > 1 ? 'Recorta en ' + BUCKETS[worst.k].label.toLowerCase() + ': ya usaste ' + pct(worst.ratio) + '% de lo que le toca.' : null,
  });

  // 2) Ahorro: lo que mandas a Ahorro, Inversión o a pagar deudas contra tu meta (20% en el 50/30/20)
  const goal = BUCKETS.savings.pct;
  const savePct = (r.spent.savings / income) * 100;
  factors.push({
    key: 'savings', label: 'Ahorro', w: 25, score: goal > 0 ? clamp01(savePct / goal) : 1,
    detail: 'Apartas ' + Math.round(savePct) + '% de tu ingreso · meta ' + goal + '%',
    tip: savePct < goal ? 'Aparta ' + Math.round(goal - savePct) + '% más de lo que cobras para llegar a tu meta de ahorro.' : null,
  });

  // 3) Límites por categoría del mes en curso (son mensuales)
  const lim = Object.entries(limits || {}).filter(([, v]) => v > 0);
  if (lim.length) {
    const byCat = report(moves, startOfMonth(now), endOfDay(now)).byCat;
    const over = lim.filter(([cat, v]) => (byCat[cat] || 0) > v);
    const near = lim.filter(([cat, v]) => (byCat[cat] || 0) > v * 0.9 && (byCat[cat] || 0) <= v);
    factors.push({
      key: 'limits', label: 'Límites', w: 15, score: clamp01((lim.length - over.length - near.length * 0.5) / lim.length),
      detail: over.length ? over.length + ' de ' + lim.length + (lim.length === 1 ? ' categoría pasó' : ' categorías pasaron') + ' su límite' : 'Vas dentro de tus ' + lim.length + (lim.length === 1 ? ' límite' : ' límites'),
      tip: over.length ? 'Ya rebasaste tu límite de ' + over.map(([c]) => c).join(', ') + ' este mes.' : null,
    });
  }

  // 4) Fondo de emergencia: meses de Necesidades que cubre tu caja de ahorro (meta: 3)
  const needs = monthlyNeedsAverage(moves, now);
  if (needs > 0) {
    const months = Math.max(saved, 0) / needs;
    factors.push({
      key: 'emergency', label: 'Fondo de emergencia', w: 15, score: clamp01(months / EMERGENCY_MONTHS),
      detail: 'Cubre ' + (months >= 10 ? Math.round(months) : months.toFixed(1)) + ' meses de necesidades · meta ' + EMERGENCY_MONTHS,
      tip: months < EMERGENCY_MONTHS ? 'Junta en tu caja de ahorro ' + EMERGENCY_MONTHS + ' meses de necesidades para cualquier imprevisto.' : null,
    });
  }

  // 5) Deuda en tarjetas contra tu ingreso mensual: hasta 30% está bien, a partir del 100% el punto queda en 0
  const hasCards = acc && acc.rows && acc.rows.some((x) => x.a.type === 'credit');
  if (hasCards) {
    const monthly = monthlyIncomeEstimate(moves, now) || income;
    const ratio = Math.max(acc.debt, 0) / monthly;
    factors.push({
      key: 'debt', label: 'Deuda en tarjetas', w: 15, score: ratio <= 0.3 ? 1 : clamp01(1 - (ratio - 0.3) / 0.7),
      detail: acc.debt > 0 ? 'Equivale a ' + pct(ratio) + '% de tu ingreso mensual' : 'Sin deuda en tarjetas',
      tip: ratio > 0.3 ? 'Tu deuda en tarjetas pesa ' + pct(ratio) + '% de lo que ganas al mes; pagarla primero te libera dinero.' : null,
    });
  }

  const totalW = factors.reduce((a, f) => a + f.w, 0);
  const score = Math.round((factors.reduce((a, f) => a + f.score * f.w, 0) / totalW) * 100);
  const level = HEALTH_LEVELS.find((l) => score >= l.min);
  // El consejo sale del factor que más puntos te está quitando
  const weakest = factors.filter((f) => f.tip).sort((a, b) => (1 - b.score) * b.w - (1 - a.score) * a.w)[0];
  return {
    score, level, factors,
    tip: weakest ? weakest.tip : 'Vas muy bien: sigue con tu reparto y tu ahorro como hasta ahora.',
  };
}
