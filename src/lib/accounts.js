import { endOfDay, midnight } from './dates';
import { asExp, msiPending, occurrences } from './finance';

// Tipos de cuenta: tarjeta de débito, de crédito y efectivo
export const ACCOUNT_TYPES = {
  debit: { label: 'Débito', icon: '🏦' },
  credit: { label: 'Crédito', icon: '💳' },
  cash: { label: 'Efectivo', icon: '💵' },
};

export const isCredit = (a) => !!a && a.type === 'credit';

// "Nu Crédito •••• 1190"
export const accountLabel = (a) => (a ? a.name + (a.last4 ? ' •••• ' + a.last4 : '') : 'Sin cuenta');

const round2 = (x) => Math.round(x * 100) / 100;

// Dinero que entra (+) o sale (−) de la cuenta con una transferencia o un ajuste
export const transferSign = (t, id) => (t.to_account_id === id ? 1 : t.from_account_id === id ? -1 : 0);

// Balance de una cuenta a hoy. El saldo inicial es el de cuando se registró la cuenta,
// así que solo cuentan los movimientos (y las veces que tocan los recurrentes) desde ese día.
// Las transferencias y los ajustes mueven el saldo pero no son gasto ni ingreso.
// Débito/efectivo: { balance }. Crédito: { debt, msiLeft, available } (available = límite − deuda − MSI que faltan).
export function accountBalance(a, moves, transfers = [], now = new Date()) {
  const from = midnight(new Date(a.created_at || now)), to = endOfDay(now);
  let flow = 0, msiLeft = 0;
  moves.forEach((m) => {
    if (m.account_id !== a.id) return;
    const k = occurrences(asExp(m), from, to);
    flow += (m.kind === 'income' ? 1 : -1) * m.amount * k;
    if (isCredit(a)) msiLeft += m.amount * msiPending(m, now).length;
  });
  transfers.forEach((t) => {
    const d = new Date(t.occurred_at);
    if (d >= from && d <= to) flow += transferSign(t, a.id) * t.amount;
  });
  if (!isCredit(a)) return { balance: round2(a.opening_balance + flow) };
  const debt = round2(a.opening_balance - flow);
  const available = a.credit_limit ? round2(a.credit_limit - debt - msiLeft) : null;
  return { debt, msiLeft: round2(msiLeft), available };
}

// Resumen de todas las cuentas activas: dinero disponible (débito + efectivo) y deuda en tarjetas
export function accountsSummary(accounts, moves, transfers = [], now = new Date()) {
  const rows = accounts.filter((a) => !a.archived).map((a) => ({ a, ...accountBalance(a, moves, transfers, now) }));
  const cash = rows.filter((r) => !isCredit(r.a)).reduce((s, r) => s + r.balance, 0);
  const debt = rows.filter((r) => isCredit(r.a)).reduce((s, r) => s + r.debt, 0);
  return { rows, cash: round2(cash), debt: round2(debt) };
}

// Siguiente fecha (a medianoche) en que cae un día del mes, desde hoy (si el mes es corto, el último día)
export function nextMonthDay(day, now = new Date()) {
  const at = (y, m) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
  const today = midnight(now), d = at(today.getFullYear(), today.getMonth());
  return d >= today ? d : at(today.getFullYear(), today.getMonth() + 1);
}

// Ajuste para que el saldo de la app coincida con el del banco (en crédito, `real` es lo que debes).
// Devuelve la fila de ajuste a guardar, o null si ya coincide.
export function adjustmentFor(a, current, real) {
  const diff = Math.round((isCredit(a) ? current - real : real - current) * 100) / 100;
  if (!diff) return null;
  return { kind: 'adjust', amount: Math.abs(diff), from_account_id: diff < 0 ? a.id : null, to_account_id: diff > 0 ? a.id : null };
}

// Días antes de la fecha límite en que se avisa el pago de la tarjeta (además del mismo día)
export const DUE_NOTICE_DAYS = 3;

// Avisos de tarjetas de crédito con deuda entre hoy y `days` días: corte (ese día) y pago (3 días antes y el día límite).
// Devuelve [{ a, kind: 'cut' | 'due' | 'due-soon', d (día del aviso), date (día del corte o del pago), debt }], por fecha.
export function cardAlerts(accounts, moves, transfers = [], now = new Date(), days = 21) {
  const today = midnight(now), out = [];
  accounts.filter((a) => isCredit(a) && !a.archived && (a.cut_day || a.due_day)).forEach((a) => {
    const { debt } = accountBalance(a, moves, transfers, now);
    if (!(debt > 0)) return;
    for (let i = 0; i <= days; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const at = (day) => d.getDate() === Math.min(day, dim);
      if (a.cut_day && at(a.cut_day)) out.push({ a, kind: 'cut', d, date: d, debt });
      if (a.due_day && at(a.due_day)) out.push({ a, kind: 'due', d, date: d, debt });
      const ahead = new Date(d.getFullYear(), d.getMonth(), d.getDate() + DUE_NOTICE_DAYS);
      const dimA = new Date(ahead.getFullYear(), ahead.getMonth() + 1, 0).getDate();
      if (a.due_day && ahead.getDate() === Math.min(a.due_day, dimA)) out.push({ a, kind: 'due-soon', d, date: ahead, debt });
    }
  });
  return out.sort((x, y) => x.d - y.d);
}

// Texto de un aviso de tarjeta (lo usan las notificaciones del teléfono)
export function cardAlertText({ a, kind, date, debt }, fmt) {
  const when = date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
  if (kind === 'cut') return { title: 'Hoy es el corte de ' + a.name, body: 'Tu deuda es de ' + fmt(debt) + '. Lo que compres desde mañana entra al siguiente estado de cuenta.' };
  if (kind === 'due') return { title: 'Hoy vence el pago de ' + a.name, body: 'Debes ' + fmt(debt) + '. Págala hoy para no pagar intereses.' };
  return { title: 'Paga tu tarjeta ' + a.name, body: 'El pago vence el ' + when + '. Debes ' + fmt(debt) + '.' };
}

// Aviso al registrar un gasto con una cuenta: tarjeta casi al límite o cuenta de débito/efectivo en negativo.
// `before` y `after` son el balance (accountBalance) antes y después del gasto. Devuelve el texto o ''.
export function spendWarning(a, before, after, fmt) {
  if (isCredit(a)) {
    if (!a.credit_limit) return '';
    const used = (b) => (b.debt + b.msiLeft) / a.credit_limit;
    if (after.available < 0) return '💳 Te pasaste del límite de ' + a.name + ' por ' + fmt(-after.available) + '.';
    if (used(after) >= 0.9 && used(before) < 0.9) return '💳 Ya usaste el ' + Math.round(used(after) * 100) + '% de tu límite en ' + a.name + '. Te quedan ' + fmt(after.available) + '.';
    return '';
  }
  if (after.balance < 0 && before.balance >= 0) return '⚠️ ' + a.name + ' quedó en negativo: ' + fmt(after.balance) + '. Revisa si el saldo está bien o ajústalo en Cuentas.';
  return '';
}

// Pagos de tarjeta de crédito cuya fecha límite cae entre hoy y `end` (fin del periodo), con lo que debes en cada una.
// No es gasto nuevo (las compras ya contaron al hacerlas): solo sirve para mostrar en Por pagar cuánto toca pagar.
// missing: tarjetas con deuda pero sin día de pago registrado (no se sabe cuándo vencen).
export function cardsDue(accounts, moves, transfers = [], now = new Date(), end = now) {
  const days = Math.max(0, Math.round((midnight(end) - midnight(now)) / 864e5));
  const items = cardAlerts(accounts, moves, transfers, now, days).filter((x) => x.kind === 'due');
  const missing = accounts.filter((a) => isCredit(a) && !a.archived && !a.due_day && accountBalance(a, moves, transfers, now).debt > 0);
  return { items, total: round2(items.reduce((s, x) => s + x.debt, 0)), missing };
}
