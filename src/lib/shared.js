import { endOfDay, midnight } from './dates';
import { asExp, occurrenceDates } from './finance';
import { isoLocal } from './format';

// Gastos compartidos (fase 1). El movimiento guarda en `amount` solo TU parte, así el 50/30/20, los límites y los
// reportes cuentan lo que de verdad te tocó. En `split` va el resto:
// { total, payer: 'me' | <nombre>, mode: 'equal' | 'percent' | 'amount', people: [{ name, share, pct?, paid: [fechas] }], mine_paid: [fechas] }
// `paid` / `mine_paid` son las veces del gasto (fecha 'YYYY-MM-DD') ya saldadas; un gasto que se repite tiene una por vez.

export const SPLIT_MODES = { equal: { label: 'Iguales' }, percent: { label: 'Porcentaje' }, amount: { label: 'Montos' } };
export const ME = 'Tú';
export const MAX_PEOPLE = 12;
export const NAME_MAX = 24;

const round2 = (x) => Math.round(x * 100) / 100;

export const isShared = (m) => !!m && m.kind === 'expense' && !!m.split && Array.isArray(m.split.people);
export const iPaid = (split) => !split.payer || split.payer === ME;
export const shareTotal = (m) => (isShared(m) ? Number(m.split.total) || m.amount : m.amount);
export const keyOf = (d) => isoLocal(d);

// Reparte `total` entre `names` (el primero eres tú). Devuelve [{ name, share, pct? }].
// equal: partes iguales (los centavos que sobran van a las primeras personas); percent: según `pcts`; amount: según `amounts`.
export function computeShares(total, names, mode, values = {}) {
  const n = names.length;
  if (!n || !(total > 0)) return names.map((name) => ({ name, share: 0 }));
  if (mode === 'percent') return names.map((name) => { const pct = Number(values[name]) || 0; return { name, pct, share: round2((total * pct) / 100) }; });
  if (mode === 'amount') return names.map((name) => ({ name, share: round2(Number(values[name]) || 0) }));
  const cents = Math.round(total * 100), base = Math.floor(cents / n), extra = cents - base * n;
  return names.map((name, i) => ({ name, share: (base + (i < extra ? 1 : 0)) / 100 }));
}

// ¿La división suma lo que debe? Devuelve '' si está bien o el texto del problema.
export function splitError(total, shares, mode) {
  if (shares.length < 2) return 'Elige al menos a otra persona.';
  if (mode === 'percent') {
    const pct = round2(shares.reduce((a, x) => a + (x.pct || 0), 0));
    if (pct !== 100) return 'Los porcentajes suman ' + pct + ' %; deben sumar 100 %.';
  }
  const sum = round2(shares.reduce((a, x) => a + x.share, 0));
  if (mode === 'amount' && sum !== round2(total)) return 'Los montos suman $' + sum.toLocaleString('es-MX') + ' de $' + round2(total).toLocaleString('es-MX') + '.';
  if (shares.some((x) => x.share < 0)) return 'Ningún monto puede ser negativo.';
  return '';
}

// Arma el `split` a guardar a partir de lo elegido en la hoja (conserva lo que ya estaba saldado al editar)
export function buildSplit({ total, mode, payer, shares, prev }) {
  const before = (name) => ((prev && prev.people) || []).find((p) => p.name === name);
  const people = shares.slice(1).map((x) => ({ name: x.name, share: x.share, ...(mode === 'percent' ? { pct: x.pct } : {}), paid: (before(x.name) || {}).paid || [] }));
  return { total: round2(total), payer, mode, ...(mode === 'percent' ? { my_pct: shares[0].pct } : {}), people, mine_paid: (prev && prev.mine_paid) || [] };
}

// Veces del gasto que ya ocurrieron hasta hoy (fechas a medianoche)
export function dueDates(m, now = new Date()) {
  return occurrenceDates(asExp(m), midnight(new Date(m.occurred_at)), endOfDay(now));
}

// Nombres que ya usaste en gastos compartidos (los más recientes primero), para ofrecerlos como atajo
export function knownPeople(moves) {
  const out = [];
  moves.forEach((m) => {
    if (!isShared(m)) return;
    if (!iPaid(m.split) && !out.includes(m.split.payer)) out.push(m.split.payer);
    m.split.people.forEach((p) => { if (!out.includes(p.name)) out.push(p.name); });
  });
  return out;
}

// Saldos por persona hasta hoy. Si tú pagaste, cada persona te debe su parte de cada vez que no esté saldada;
// si pagó otra persona, tú le debes tu parte (lo que deban los demás entre ellos no se lleva aquí).
// Devuelve { people: [{ name, owesMe, iOwe, net, items }], owedToMe, iOwe }. items: [{ m, key, date, amount, dir: 'in'|'out', paid }]
// `remote`: gastos de otras personas donde tú apareces (shared_with_me). Si pagó el dueño, le debes tu parte;
// si pagaste tú, el dueño te debe la suya. Sus items llevan remote: true (se saldan con mark_shared_paid).
export function sharedBalances(moves, now = new Date(), remote = []) {
  const map = new Map();
  const get = (name) => { if (!map.has(name)) map.set(name, { name, owesMe: 0, iOwe: 0, items: [], linked: false }); return map.get(name); };
  moves.forEach((m) => {
    if (!isShared(m)) return;
    const dates = dueDates(m, now);
    if (iPaid(m.split)) {
      m.split.people.forEach((p) => {
        if (!(p.share > 0)) return;
        const who = get(p.name);
        dates.forEach((d) => {
          const key = keyOf(d), paid = (p.paid || []).includes(key);
          if (!paid) who.owesMe += p.share;
          who.items.push({ m, key, date: d, amount: p.share, dir: 'in', paid });
        });
      });
    } else if (m.amount > 0) {
      const who = get(m.split.payer);
      dates.forEach((d) => {
        const key = keyOf(d), paid = (m.split.mine_paid || []).includes(key);
        if (!paid) who.iOwe += m.amount;
        who.items.push({ m, key, date: d, amount: m.amount, dir: 'out', paid });
      });
    }
  });
  remote.forEach((r) => {
    const sp = r.split;
    if (!sp || !Array.isArray(sp.people)) return;
    const m = { ...r, kind: 'expense', amount: Number(r.amount) };
    const dates = dueDates(m, now);
    const who = get(r.owner_name);
    who.linked = true;
    if (iPaid(sp)) {
      const me = sp.people.find((p) => p.name === r.my_name);
      if (!me || !(me.share > 0)) return;
      dates.forEach((d) => {
        const key = keyOf(d), paid = (me.paid || []).includes(key);
        if (!paid) who.iOwe += me.share;
        who.items.push({ m, key, date: d, amount: me.share, dir: 'out', paid, remote: true });
      });
    } else if (sp.payer === r.my_name && m.amount > 0) {
      dates.forEach((d) => {
        const key = keyOf(d), paid = (sp.mine_paid || []).includes(key);
        if (!paid) who.owesMe += m.amount;
        who.items.push({ m, key, date: d, amount: m.amount, dir: 'in', paid, remote: true });
      });
    }
  });
  const people = [...map.values()].map((p) => ({ ...p, owesMe: round2(p.owesMe), iOwe: round2(p.iOwe), net: round2(p.owesMe - p.iOwe), items: p.items.sort((a, b) => b.date - a.date) }))
    .sort((a, b) => Math.abs(b.owesMe + b.iOwe) - Math.abs(a.owesMe + a.iOwe) || a.name.localeCompare(b.name));
  return {
    people,
    owedToMe: round2(people.reduce((a, p) => a + p.owesMe, 0)),
    iOwe: round2(people.reduce((a, p) => a + p.iOwe, 0)),
  };
}

// Marca como saldado (o pendiente, con `paid` = false) lo de una persona en las fechas `keys`. Devuelve el `split` nuevo.
export function settleSplit(m, name, keys, paid = true) {
  const toggle = (list) => (paid ? [...new Set([...(list || []), ...keys])] : (list || []).filter((k) => !keys.includes(k)));
  if (!iPaid(m.split)) return { ...m.split, mine_paid: toggle(m.split.mine_paid) };
  return { ...m.split, people: m.split.people.map((p) => (p.name === name ? { ...p, paid: toggle(p.paid) } : p)) };
}

// Cuánto sale de la cuenta del gasto entre from y to. Si tú pagaste: el total de cada vez, menos lo que ya te regresaron
// (lo saldado vuelve a la misma cuenta, sin contar como ingreso). Si pagó otra persona: solo tu parte, cuando le pagas.
export function sharedAccountOut(m, from, to) {
  return occurrenceDates(asExp(m), from, to).reduce((sum, d) => {
    const key = keyOf(d);
    if (!iPaid(m.split)) return sum + ((m.split.mine_paid || []).includes(key) ? m.amount : 0);
    const back = m.split.people.reduce((a, p) => a + ((p.paid || []).includes(key) ? p.share : 0), 0);
    return sum + (Number(m.split.total) || m.amount) - back;
  }, 0);
}

// "con Ana y Luis" / "con Ana, Luis y 2 más"
export function withWhom(split) {
  const names = [...(iPaid(split) ? [] : [split.payer]), ...split.people.map((p) => p.name)].filter((x, i, a) => x && a.indexOf(x) === i);
  if (names.length <= 1) return 'con ' + (names[0] || 'alguien');
  if (names.length === 2) return 'con ' + names[0] + ' y ' + names[1];
  if (names.length === 3) return 'con ' + names[0] + ', ' + names[1] + ' y ' + names[2];
  return 'con ' + names[0] + ', ' + names[1] + ' y ' + (names.length - 2) + ' más';
}
