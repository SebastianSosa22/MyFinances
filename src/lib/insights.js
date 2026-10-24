import { CATS } from '../constants/budget';
import { BUCKETS } from '../constants/budget';
import { endOfDay, startOfMonth } from './dates';
import { bucketOf, isActive, isRecurring, report } from './finance';
import { money } from './format';

// "IA" gratuita y privada: reglas y estadística calculadas en el propio dispositivo con TUS movimientos.
// Nada sale del teléfono, no hay cuotas ni claves. Cada persona obtiene sugerencias distintas porque se aprenden de su historial.

const norm = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['de', 'la', 'el', 'en', 'y', 'a', 'por', 'para', 'con', 'del', 'los', 'las', 'un', 'una', 'al', 'pago', 'compra']);
const tokens = (t) => norm(t).split(' ').filter((w) => w.length > 2 && !STOP.has(w));
const icon = (cat) => { const c = CATS.find((z) => z.name === cat); return c ? c.icon : '🧾'; };

// Arranque en frío: palabras comunes para quien aún no tiene historial
const DEFAULT_WORDS = {
  Comida: ['super', 'walmart', 'soriana', 'chedraui', 'oxxo', 'despensa', 'mercado', 'tortilleria', 'fruta', 'verdura', 'bodega', 'costco'],
  Restaurantes: ['restaurante', 'taco', 'tacos', 'pizza', 'sushi', 'mcdonalds', 'uber eats', 'didi food', 'rappi', 'hamburguesa', 'comida rapida'],
  Transporte: ['uber', 'didi', 'metro', 'camion', 'pasaje', 'taxi', 'metrobus', 'boleto avion'],
  Auto: ['gasolina', 'gas auto', 'estacionamiento', 'caseta', 'verificacion', 'tenencia', 'taller', 'llantas', 'aceite', 'lavado'],
  Hogar: ['muebles', 'limpieza', 'detergente', 'ferreteria', 'home depot', 'reparacion', 'plomero', 'electricista'],
  Educación: ['colegiatura', 'escuela', 'universidad', 'curso', 'libro', 'libros', 'utiles', 'clase', 'clases'],
  Seguros: ['seguro', 'poliza', 'gnp', 'axa', 'qualitas'],
  Hijos: ['panales', 'guarderia', 'juguete', 'juguetes', 'bebe'],
  Mascotas: ['veterinario', 'croquetas', 'mascota', 'perro', 'gato'],
  Impuestos: ['sat', 'impuesto', 'predial', 'isr', 'iva'],
  Ropa: ['ropa', 'zapatos', 'tenis', 'zara', 'shein', 'h&m', 'pull and bear'],
  Viajes: ['hotel', 'vuelo', 'airbnb', 'aeromexico', 'volaris', 'viva aerobus', 'viaje', 'vacaciones'],
  Regalos: ['regalo', 'cumpleanos', 'detalle'],
  Belleza: ['corte', 'peluqueria', 'barberia', 'unas', 'maquillaje', 'spa'],
  Deporte: ['gimnasio', 'gym', 'smart fit', 'futbol', 'deporte', 'yoga'],
  Tecnología: ['celular nuevo', 'audifonos', 'laptop', 'computadora', 'cargador', 'apple store'],
  Café: ['cafe', 'starbucks', 'cafeteria', 'latte'],
  Servicios: ['luz', 'cfe', 'agua', 'internet', 'telmex', 'telcel', 'gas', 'celular', 'izzi', 'totalplay', 'recarga'],
  Renta: ['renta', 'alquiler'],
  Salud: ['farmacia', 'medico', 'doctor', 'dentista', 'consulta', 'medicina', 'hospital', 'laboratorio'],
  Suscripciones: ['spotify', 'netflix', 'disney', 'hbo', 'prime', 'youtube', 'icloud', 'apple', 'chatgpt', 'claude', 'suscripcion', 'membresia'],
  Ocio: ['cine', 'concierto', 'boleto', 'juego', 'steam', 'playstation', 'bar', 'fiesta'],
  Compras: ['amazon', 'mercado libre', 'liverpool', 'tienda', 'coppel'],
  Ahorro: ['ahorro', 'apartado'],
  Inversión: ['inversion', 'cetes', 'gbm', 'etf', 'bolsa'],
  Deudas: ['tarjeta', 'credito', 'prestamo', 'deuda', 'mensualidad'],
};

// Al escribir la descripción de un gasto: sugiere categoría y monto aprendiendo de lo que ESTA persona ya registró
export function suggestFromNote(moves, text) {
  const q = norm(text);
  if (q.length < 3) return null;
  const qt = tokens(text);
  const cats = {};
  moves.forEach((m) => {
    if (m.kind !== 'expense' || !m.note || !m.cat) return;
    const nt = tokens(m.note);
    const common = qt.filter((t) => nt.some((u) => u === t || (t.length >= 4 && u.length >= 4 && (u.startsWith(t) || t.startsWith(u))))).length;
    if (!common) return;
    const w = common / Math.max(qt.length, nt.length) + (norm(m.note) === q ? 1 : 0);
    const at = new Date(m.occurred_at).getTime();
    const c = cats[m.cat] || (cats[m.cat] = { w: 0, amount: null, at: 0 });
    c.w += w;
    if (at > c.at) { c.at = at; c.amount = m.amount; }
  });
  const top = Object.entries(cats).sort((a, b) => b[1].w - a[1].w)[0];
  if (top) return { cat: top[0], amount: top[1].amount, source: 'historial' };
  const padded = ' ' + q + ' ';
  for (const [cat, words] of Object.entries(DEFAULT_WORDS)) {
    if (words.some((w) => padded.includes(' ' + w + ' '))) return { cat, amount: null, source: 'sugerido' };
  }
  return null;
}

// Límites mensuales sugeridos: promedio de los últimos 3 meses con datos + 10%, redondeado a $50
// Sugerencias por categoría: tu promedio mensual de los últimos 3 meses con datos, + 10% redondeado a $50.
// Si aún no tienes un mes anterior con gastos (cuenta nueva), usa lo que llevas en el mes en curso.
// Devuelve { items: [{ cat, avg, amount }] de mayor a menor, months: meses usados (0 = el mes en curso) }.
export function limitSuggestions(moves, now = new Date()) {
  const months = [];
  for (let k = 1; k <= 3; k++) {
    const from = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const r = report(moves, from, endOfDay(new Date(from.getFullYear(), from.getMonth() + 1, 0)));
    if (r.total > 0) months.push(r.byCat);
  }
  const base = months.length ? months : [report(moves, startOfMonth(now), now).byCat];
  const items = CATS.filter((c) => c.bucket !== 'savings')
    .map((c) => ({ cat: c.name, avg: base.reduce((a, byCat) => a + (byCat[c.name] || 0), 0) / base.length }))
    .filter((x) => x.avg > 0)
    .map((x) => ({ ...x, amount: Math.max(Math.ceil((x.avg * 1.1) / 50) * 50, 50) }))
    .sort((a, b) => b.avg - a.avg);
  return { items, months: months.length };
}

export function suggestLimits(moves, now = new Date()) {
  return Object.fromEntries(limitSuggestions(moves, now).items.map((x) => [x.cat, x.amount]));
}

const FACTOR = { weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, yearly: 1 / 12 };
const monthlyEq = (m) => m.amount * (FACTOR[m.freq] || 0);

// Ingreso mensual estimado: ingresos recurrentes vigentes o, si no hay, el promedio de los meses anteriores
export function monthlyIncomeEstimate(moves, now = new Date()) {
  const rec = moves.filter((m) => m.kind === 'income' && isRecurring(m) && isActive(m, now)).reduce((a, m) => a + monthlyEq(m), 0);
  if (rec > 0) return rec;
  const vals = [];
  for (let k = 1; k <= 3; k++) {
    const from = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const r = report(moves, from, endOfDay(new Date(from.getFullYear(), from.getMonth() + 1, 0)));
    if (r.income > 0) vals.push(r.income);
  }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

// Equivalente mensual de los pagos fijos vigentes (sin contar Ahorro)
export function fixedMonthly(moves, now = new Date()) {
  return moves
    .filter((m) => m.kind === 'expense' && isRecurring(m) && isActive(m, now) && bucketOf(m.cat) !== 'savings')
    .reduce((a, m) => a + monthlyEq(m), 0);
}

// Mensajes personalizados para el Resumen (máximo 3). Se calculan con el historial de cada usuario.
export function buildInsights(moves, settings, now = new Date()) {
  if (!moves.length) return [];
  const out = [];
  const cur = report(moves, startOfMonth(now), now);

  const hist = [];
  for (let k = 1; k <= 3; k++) {
    const from = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const r = report(moves, from, endOfDay(new Date(from.getFullYear(), from.getMonth() + 1, 0)));
    if (r.total > 0 || r.income > 0) hist.push({ k, r });
  }

  // 1) Una categoría ya superó lo que sueles gastar en TODO el mes
  if (hist.length) {
    let worst = null;
    Object.entries(cur.byCat).forEach(([cat, amt]) => {
      if (bucketOf(cat) === 'savings') return;
      const avg = hist.reduce((a, h) => a + (h.r.byCat[cat] || 0), 0) / hist.length;
      if (avg >= 200 && amt > avg && (!worst || amt / avg > worst.ratio)) worst = { cat, amt, avg, ratio: amt / avg };
    });
    if (worst) out.push({ tone: 'warn', icon: icon(worst.cat), text: 'Ya llevas ' + money(worst.amt) + ' en ' + worst.cat + ' este mes, más de lo que sueles gastar en todo el mes (' + money(worst.avg) + ').' });
  }

  // 2) Peso de tus pagos fijos
  const fm = fixedMonthly(moves, now);
  if (fm > 0) {
    const inc = monthlyIncomeEstimate(moves, now);
    const pct = inc > 0 ? Math.round((fm / inc) * 100) : null;
    out.push({ tone: pct !== null && pct > 60 ? 'warn' : 'info', icon: '🔁', text: 'Tus pagos fijos suman unos ' + money(fm) + ' al mes' + (pct !== null ? ' (' + pct + '% de tus ingresos).' : '.') });
  }

  // 3) Cómo te fue ahorrando el mes pasado frente a tu meta
  const last = hist.find((h) => h.k === 1);
  if (last && last.r.income > 0) {
    const target = BUCKETS.savings.pct;
    const pct = Math.round((last.r.spent.savings / last.r.income) * 100);
    if (pct >= target) out.push({ tone: 'good', icon: '🎉', text: 'El mes pasado destinaste ' + pct + '% de tus ingresos a ahorro: cumpliste tu meta de ' + target + '%.' });
    else out.push({ tone: 'info', icon: '🐷', text: 'El mes pasado destinaste ' + pct + '% a ahorro y tu meta es ' + target + '%. Apartar ' + money(((target - pct) / 100) * last.r.income) + ' más al mes te llevaría a la meta.' });
  }

  // 4) Un gasto reciente muy por encima de lo habitual en su categoría
  const oneOff = moves.filter((m) => m.kind === 'expense' && !isRecurring(m));
  const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  let big = null;
  oneOff.filter((m) => new Date(m.occurred_at) >= weekAgo).forEach((m) => {
    const same = oneOff.filter((x) => x.cat === m.cat && x.id !== m.id).map((x) => x.amount).sort((a, b) => a - b);
    if (same.length < 4) return;
    const med = same[Math.floor(same.length / 2)];
    if (m.amount >= 3 * med && m.amount >= 300 && (!big || m.amount / med > big.r)) big = { m, r: m.amount / med };
  });
  if (big) out.push({ tone: 'info', icon: '🔎', text: 'El gasto "' + (big.m.note || big.m.cat) + '" (' + money(big.m.amount) + ') es unas ' + Math.round(big.r) + ' veces tu gasto típico en ' + big.m.cat + '.' });

  const order = { warn: 0, info: 1, good: 2 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 3);
}
