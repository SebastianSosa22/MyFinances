import { BUCKETS } from '../constants/budget';
import { endOfDay, midnight, startOfMonth } from './dates';
import { report } from './finance';
import { monthlyIncomeEstimate } from './insights';
import { monthlyNeedsAverage } from './summary';

// Salud financiera: una calificación de 0 a 100 hecha con tus propios datos, en el dispositivo.
// Cada factor da de 0 a 1 y pesa lo que dice `w`. Si no hay datos para un factor (sin límites, sin tarjetas...),
// no cuenta y su peso se reparte entre los demás, para no castigarte por algo que no usas.

export const HEALTH_LEVELS = [
  { min: 80, label: 'Excelente', tone: 'good', text: 'Tus finanzas están en gran forma.' },
  { min: 60, label: 'Buena', tone: 'ok', text: 'Vas bien, con algunos puntos por mejorar.' },
  { min: 40, label: 'Regular', tone: 'warn', text: 'Hay varias cosas que conviene ajustar.' },
  { min: 0, label: 'En riesgo', tone: 'bad', text: 'Tus finanzas necesitan atención pronto.' },
];

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const pct = (x) => Math.round(x * 100);
const EMERGENCY_MONTHS = 3;
const monthsText = (m) => {
  const v = m >= 10 ? Math.round(m) : Math.round(m * 10) / 10;
  return v === 1 ? '1 mes' : v + ' meses';
};

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
  // Si alguna parte se pasa, el factor no puede quedar en "Bien" (máx. 0.79), para que el estado coincida con el texto
  const splitScore = Math.min(parts.reduce((a, p) => a + p.score * BUCKETS[p.k].pct, 0) / wSum, parts.some((p) => p.ratio > 1) ? 0.79 : 1);
  const worst = parts.slice().sort((a, b) => b.ratio - a.ratio)[0];
  factors.push({
    key: 'split', label: 'Plan ' + [BUCKETS.needs.pct, BUCKETS.wants.pct, BUCKETS.savings.pct].join('/'), w: 30, score: splitScore,
    detail: worst.ratio > 1 ? 'En ' + BUCKETS[worst.k].label.toLowerCase() + ' gastas ' + pct(worst.ratio - 1) + '% más de lo planeado' : 'Tus gastos van dentro de lo planeado',
    tip: worst.ratio > 1 ? 'Recorta en ' + BUCKETS[worst.k].label.toLowerCase() + ': ya usaste ' + pct(worst.ratio) + '% de su parte.' : null,
  });

  // 2) Ahorro: lo que mandas a Ahorro, Inversión o a pagar deudas contra tu meta (20% en el 50/30/20)
  const goal = BUCKETS.savings.pct;
  const savePct = (r.spent.savings / income) * 100;
  factors.push({
    key: 'savings', label: 'Ahorro', w: 25, score: goal > 0 ? clamp01(savePct / goal) : 1,
    detail: 'Apartas ' + Math.round(savePct) + '% de lo que ganas (meta: ' + goal + '%)',
    tip: savePct < goal ? 'Aparta ' + Math.round(goal - savePct) + '% más de tu ingreso para llegar a tu meta de ahorro.' : null,
  });

  // 3) Límites por categoría del mes en curso (son mensuales)
  const lim = Object.entries(limits || {}).filter(([, v]) => v > 0);
  if (lim.length) {
    const byCat = report(moves, startOfMonth(now), endOfDay(now)).byCat;
    const over = lim.filter(([cat, v]) => (byCat[cat] || 0) > v);
    const near = lim.filter(([cat, v]) => (byCat[cat] || 0) > v * 0.9 && (byCat[cat] || 0) <= v);
    factors.push({
      key: 'limits', label: 'Límites', w: 15, score: clamp01((lim.length - over.length - near.length * 0.5) / lim.length),
      detail: over.length ? over.length + ' de ' + lim.length + (lim.length === 1 ? ' categoría pasó' : ' categorías pasaron') + ' su límite este mes' : (lim.length === 1 ? 'Tu categoría va' : 'Tus ' + lim.length + ' categorías van') + ' dentro de su límite',
      tip: over.length ? 'Ya rebasaste tu límite de ' + over.map(([c]) => c).join(', ') + ' este mes.' : null,
    });
  }

  // 4) Fondo de emergencia: meses de Necesidades que cubre tu caja de ahorro (meta: 3)
  const needs = monthlyNeedsAverage(moves, now);
  if (needs > 0) {
    const months = Math.max(saved, 0) / needs;
    factors.push({
      key: 'emergency', label: 'Colchón para imprevistos', w: 15, score: clamp01(months / EMERGENCY_MONTHS),
      detail: 'Tus ahorros alcanzan para ' + monthsText(months) + ' de gastos básicos (meta: ' + EMERGENCY_MONTHS + ' meses)',
      tip: months < EMERGENCY_MONTHS ? 'Junta ' + EMERGENCY_MONTHS + ' meses de necesidades en tu caja de ahorro.' : null,
    });
  }

  // 5) Deuda en tarjetas contra tu ingreso mensual: hasta 30% está bien, a partir del 100% el punto queda en 0
  const hasCards = acc && acc.rows && acc.rows.some((x) => x.a.type === 'credit');
  if (hasCards) {
    const monthly = monthlyIncomeEstimate(moves, now) || income;
    const ratio = Math.max(acc.debt, 0) / monthly;
    factors.push({
      key: 'debt', label: 'Deuda en tarjetas', w: 15, score: ratio <= 0.3 ? 1 : clamp01(1 - (ratio - 0.3) / 0.7),
      detail: acc.debt > 0 ? 'Debes el ' + pct(ratio) + '% de lo que ganas al mes' : 'No debes nada en tus tarjetas',
      tip: ratio > 0.3 ? 'Prioriza tus tarjetas: deben ' + pct(ratio) + '% de tu ingreso mensual.' : null,
    });
  }

  const totalW = factors.reduce((a, f) => a + f.w, 0);
  const score = Math.round((factors.reduce((a, f) => a + f.score * f.w, 0) / totalW) * 100);
  const level = HEALTH_LEVELS.find((l) => score >= l.min);
  // El consejo sale del factor que más puntos te está quitando
  const weakest = factors.filter((f) => f.tip).sort((a, b) => (1 - b.score) * b.w - (1 - a.score) * a.w)[0];
  return {
    score, level, factors,
    tip: weakest ? weakest.tip : 'Vas muy bien: sigue así con tu reparto y tu ahorro.',
  };
}
