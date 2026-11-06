import { KEPT } from './summary';

// Fondo de emergencia: lo usan Salud financiera (Inicio) y Ahorro y metas, con la misma meta y el mismo dinero.
export const EMERGENCY_OPTS = [3, 6, 12];
export const EMERGENCY_DEFAULT = 3;

// ¿El usuario ya creó su propia meta de fondo de emergencia?
export const emergencyGoal = (goals = []) => goals.find((g) => /emergencia/i.test(g.name || '')) || null;

// Dinero del fondo: lo ahorrado sin meta (y lo aportado a su propia meta de emergencia, si la tiene).
// Lo aportado a otras metas (un viaje, un auto...) no cuenta, para no contar el mismo dinero dos veces.
export function emergencySaved(moves, goals = [], now = new Date()) {
  const goal = emergencyGoal(goals);
  const saved = moves
    .filter((m) => m.kind === 'expense' && KEPT.includes(m.cat) && new Date(m.occurred_at) <= now && (!m.goal_id || (goal && m.goal_id === goal.id)))
    .reduce((a, m) => a + m.amount, 0);
  return { saved, goal };
}

// "unos 9 días", "1.5 meses", "2 meses": más fácil de leer que "0.3 meses"
export function coverText(months) {
  if (months < 1) {
    const d = Math.round(months * 30);
    return d <= 0 ? 'nada' : d === 1 ? '1 día' : 'unos ' + d + ' días';
  }
  const v = months >= 10 ? Math.round(months) : Math.round(months * 10) / 10;
  return v === 1 ? '1 mes' : v + ' meses';
}
