import { endOfDay, nextPeriodStart, periodEnd, periodStart } from './dates';
import { report } from './finance';
import { pendingFixed } from './summary';

// Caja de ahorro: lo que sobra de cada ciclo ya cerrado (ingresos - gastos) pasa solo a la caja.
// Es un valor calculado a partir de tus movimientos, así que siempre está al día y no se captura a mano.
export function savingsBox(moves, settings, now = new Date()) {
  const { cycle, reservePct } = settings;
  const first = moves.reduce((a, m) => Math.min(a, new Date(m.occurred_at).getTime()), now.getTime());
  const curStart = periodStart(cycle, now);

  const closed = [];
  let start = periodStart(cycle, new Date(first));
  while (start < curStart && closed.length < 600) {
    const end = periodEnd(cycle, start);
    const r = report(moves, start, endOfDay(end));
    closed.push({ start, end, income: r.income, spent: r.total, saved: r.income - r.total });
    start = nextPeriodStart(cycle, start);
  }

  // Ciclo en curso: la reserva (si la hay) se aparta desde que entra el ingreso
  const end = periodEnd(cycle, curStart);
  const cur = report(moves, curStart, now);
  const reserved = (cur.income * reservePct) / 100;
  const pending = pendingFixed(moves, now, end);
  const boxClosed = closed.reduce((a, c) => a + c.saved, 0);

  return {
    cur, end, reserved, pending, closed,
    box: boxClosed + reserved,
    available: cur.income - reserved - cur.total,
    closing: cur.income - cur.total - pending, // lo que se sumaría a la caja al cerrar el ciclo, con los pagos fijos que faltan
    goalsSaved: moves.filter((m) => m.goal_id).reduce((a, m) => a + m.amount, 0),
  };
}
