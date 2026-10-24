import { PERF_METRICS, SCREEN_LABELS } from '../constants/analytics';

// Tiempo relativo corto: "hace 5 min", "hace 3 h", "hace 2 d"
export function ago(iso, now = new Date()) {
  if (!iso) return 'nunca';
  const min = Math.max(0, Math.round((now - new Date(iso)) / 60000));
  if (min < 1) return 'ahora';
  if (min < 60) return 'hace ' + min + ' min';
  const h = Math.round(min / 60);
  if (h < 24) return 'hace ' + h + ' h';
  const d = Math.round(h / 24);
  return d < 60 ? 'hace ' + d + ' d' : 'hace ' + Math.round(d / 30) + ' meses';
}

export const pct = (part, total) => (total > 0 ? Math.round((100 * part) / total) : 0);

export const secs = (ms) => (ms == null ? '—' : ms < 1000 ? ms + ' ms' : (ms / 1000).toFixed(1) + ' s');

// Semáforo de una métrica de rendimiento según su p95
export function perfTone(metric, ms) {
  const m = PERF_METRICS[metric];
  if (!m || ms == null) return 'info';
  return ms <= m.good ? 'good' : ms <= m.ok ? 'warn' : 'bad';
}

const sum = (obj) => Object.values(obj || {}).reduce((a, n) => a + Number(n || 0), 0);

// Ordena la lista de usuarios: 'recent' (actividad), 'moves' (más movimientos) o 'new' (más nuevos)
export function sortUsers(users, by) {
  const list = [...(users || [])];
  if (by === 'moves') return list.sort((a, b) => b.movements - a.movements);
  if (by === 'new') return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return list.sort((a, b) => new Date(b.last_active || 0) - new Date(a.last_active || 0));
}

// Ideas de mejora a partir de los datos del panel. Cada una: { tone: 'good' | 'warn' | 'bad' | 'info', text }
export function buildAdminInsights(d) {
  if (!d) return [];
  const k = d.kpis;
  const out = [];
  const users = k.users || 0;
  const usersList = d.users || [];

  if (!k.events_period) {
    out.push({ tone: 'info', text: 'La bitácora de uso aún está vacía: se llena en cuanto los usuarios abran la versión nueva de la app. Mientras tanto, la actividad se calcula con inicios de sesión y movimientos.' });
  }
  if (k.inactive_14d > 0) {
    out.push({ tone: 'warn', text: k.inactive_14d + ' de ' + users + ' usuarios no han usado la app en 14 días. Un recordatorio push o un aviso de novedades puede traerlos de vuelta.' });
  }
  const noPush = users - (k.push_users || 0);
  if (users > 0 && noPush > 0) {
    out.push({ tone: pct(k.push_users, users) < 50 ? 'warn' : 'info', text: noPush + ' usuarios no tienen notificaciones activas (' + pct(k.push_users, users) + '% sí). Sin ellas no reciben recordatorios de registrar sus gastos.' });
  }
  const notOnboarded = users - (k.onboarded || 0);
  if (notOnboarded > 0) {
    out.push({ tone: 'info', text: notOnboarded + ' usuarios no completaron el asistente de bienvenida (ciclo de cobro y reparto). Revisa si el asistente es claro o si lo están saltando.' });
  }
  const noLimits = usersList.filter((u) => !u.limits).length;
  if (users > 0 && noLimits === users) {
    out.push({ tone: 'info', text: 'Nadie usa límites por categoría. Quizá conviene sugerirlos desde el Resumen en lugar de tenerlos solo en Ajustes.' });
  }
  const noGoals = usersList.filter((u) => !u.goals).length;
  if (users > 1 && noGoals >= users - 1) {
    out.push({ tone: 'info', text: 'Casi nadie ha creado metas (' + (users - noGoals) + ' de ' + users + '). Un acceso más visible a Metas podría ayudar.' });
  }
  const moves = sum(d.by_freq);
  if (moves >= 20 && pct(d.by_freq.once || 0, moves) >= 95) {
    out.push({ tone: 'info', text: 'Casi todos los movimientos son de una sola vez. Los pagos recurrentes (renta, suscripciones) ahorran capturas: valdría la pena destacarlos al registrar.' });
  }
  if (moves >= 20 && (d.with_note_pct || 0) < 30) {
    out.push({ tone: 'info', text: 'Solo el ' + d.with_note_pct + '% de los movimientos lleva descripción. Si quieres reportes más útiles, sugiere descripciones rápidas.' });
  }
  if (moves >= 20 && sum(d.by_source) === (d.by_source.app || 0)) {
    out.push({ tone: 'info', text: 'Todos los movimientos se capturan a mano. El registro automático (Atajos de iPhone) sería la mejora que más tiempo les ahorra.' });
  }
  if (k.sessions_period >= 5) {
    const seen = new Set((d.screens || []).map((x) => x.screen));
    const unused = Object.keys(SCREEN_LABELS).filter((key) => key !== 'admin' && !seen.has(key)).map((key) => SCREEN_LABELS[key]);
    if (unused.length) out.push({ tone: 'warn', text: 'Pantallas que nadie abrió en el periodo: ' + unused.join(', ') + '. Considera simplificarlas o hacerlas más visibles.' });
  }
  (d.perf || []).forEach((p) => {
    const tone = perfTone(p.metric, p.p95);
    if (tone === 'bad' && PERF_METRICS[p.metric]) out.push({ tone: 'bad', text: PERF_METRICS[p.metric].label + ' es lenta: el 5% más lento tarda ' + secs(p.p95) + '. Vale la pena optimizarla.' });
  });
  if (k.errors_period > 0) {
    out.push({ tone: 'bad', text: 'Hubo ' + k.errors_period + ' errores en el periodo. Revisa la lista en Rendimiento.' });
  }
  if (!out.some((x) => x.tone === 'warn' || x.tone === 'bad') && k.events_period) {
    out.push({ tone: 'good', text: 'Todo se ve sano: sin errores, sin pantallas lentas y los usuarios siguen activos.' });
  }
  return out;
}
