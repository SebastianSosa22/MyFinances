import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Modal, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet, OptionRow } from '../components/BottomSheet';
import { Icon } from '../components/Icon';
import { WheelBand, WheelColumn } from '../components/WheelPicker';
import { Segmented } from '../components/ui';
import { CATS, DAYS, DAY_ORDER } from '../constants/budget';
import { daysIn, midnight } from '../lib/dates';
import { ACCOUNT_TYPES, accountBalance, isCredit } from '../lib/accounts';
import { moveTitle, msiAdvance, msiPending, parseDay } from '../lib/finance';
import { commas, isoLocal, money, shortDate } from '../lib/format';
import { suggestFromNote } from '../lib/insights';
import { KEPT, periodView } from '../lib/summary';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

// Tipos de ingreso: se guardan como concepto del ingreso (si no escribes otro)
export const INCOME_CATS = [
  { name: 'Sueldo', icon: '💼' }, { name: 'Honorarios', icon: '🧾' }, { name: 'Ventas', icon: '🛍️' },
  { name: 'Reembolso', icon: '↩️' }, { name: 'Regalo', icon: '🎁' }, { name: 'Bono', icon: '🎉' },
  { name: 'Aguinaldo', icon: '🎄' }, { name: 'Rendimientos', icon: '📈' }, { name: 'Renta cobrada', icon: '🏠' },
  { name: 'Otros ingresos', icon: '💵' },
];
const SAVE_CATS = CATS.filter((c) => KEPT.includes(c.name));
const SPEND_CATS = CATS.filter((c) => !KEPT.includes(c.name));
const DEFAULT_ORDER = ['Comida', 'Compras', 'Transporte', 'Servicios', 'Restaurantes'];
const TABS = { expense: { label: 'Gasto' }, income: { label: 'Ingreso' }, saving: { label: 'Ahorro' } };
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];
const MSI_OPTS = [3, 6, 9, 12, 18, 24];
const REPEATS = { once: 'No se repite', weekly: 'Cada semana', biweekly: 'Cada 2 semanas', monthly: 'Cada mes', yearly: 'Cada año' };
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const round2 = (x) => Math.round(x * 100) / 100;

// Monto escrito con el teclado de la pantalla: máximo 2 decimales y sin ceros a la izquierda
function press(raw, k) {
  if (k === 'del') return raw.slice(0, -1);
  if (k === '.') return raw.includes('.') ? raw : (raw || '0') + '.';
  if (raw.includes('.') && raw.split('.')[1].length >= 2) return raw;
  if (raw === '0') return k;
  return (raw + k).slice(0, 10);
}

// ¿Se repite?: frecuencia y, si toca, el día de la semana o del mes
function RepeatSheet({ visible, onClose, freq, setFreq, wday, setWday, mday, setMday, isIncome }) {
  const opts = Object.entries(REPEATS).filter(([k]) => !(isIncome && k === 'yearly'));
  return (
    <BottomSheet visible={visible} onClose={onClose} title="¿Se repite?" subtitle="Para pagos que llegan cada semana o cada mes, como la renta, tu sueldo o una suscripción.">
      {opts.map(([k, label], i) => <OptionRow key={k} first={i === 0} label={label} on={freq === k} onPress={() => setFreq(k)} />)}
      {freq === 'weekly' && (
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          {DAY_ORDER.map((d) => (
            <Pressable key={d} onPress={() => setWday(d)} style={[s.dayChip, wday === d && { backgroundColor: C.primary }]}>
              <Text style={[s.chipText, { fontSize: 13 }, wday === d && { color: '#fff' }]}>{DAYS[d]}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {freq === 'monthly' && (
        <View style={s.stepperBig}>
          <Pressable style={s.stepBig} onPress={() => setMday(mday <= 1 ? 31 : mday - 1)}><Text style={s.stepBigText}>−</Text></Pressable>
          <Text style={[s.body, { fontWeight: '600', fontSize: 18 }]}>El día {mday} de cada mes</Text>
          <Pressable style={s.stepBig} onPress={() => setMday(mday >= 31 ? 1 : mday + 1)}><Text style={s.stepBigText}>+</Text></Pressable>
        </View>
      )}
      <Pressable style={[s.saveBtn, { backgroundColor: C.primary, marginTop: 16 }]} onPress={onClose}><Text style={s.saveBtnText}>Listo</Text></Pressable>
    </BottomSheet>
  );
}

const QuickDay = ({ label, value, date, setDate }) => (
  <Pressable onPress={() => setDate(value)} style={[s.fChip, sameDay(date, value) && s.fChipOn]}>
    <Text style={[s.fChipText, sameDay(date, value) && { color: '#fff', fontWeight: '600' }]}>{label}</Text>
  </Pressable>
);

// ¿Cuándo fue?: atajos Hoy / Ayer y una rueda de día, mes y año
function DateSheet({ visible, onClose, date, setDate }) {
  const today = midnight(new Date()), yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const years = Array.from({ length: 6 }, (_, i) => today.getFullYear() - 4 + i);
  const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
  const days = Array.from({ length: daysIn(y, m) }, (_, i) => String(i + 1));
  const set = (yy, mm, dd) => setDate(new Date(yy, mm, Math.min(dd, daysIn(yy, mm))));
  return (
    <BottomSheet visible={visible} onClose={onClose} title="¿Cuándo fue?">
      <View style={[s.chipsRow, { marginTop: -8 }]}>
        <QuickDay label="Hoy" value={today} date={date} setDate={setDate} />
        <QuickDay label="Ayer" value={yesterday} date={date} setDate={setDate} />
      </View>
      <View style={{ flexDirection: 'row', marginTop: 14 }}>
        <WheelBand />
        <WheelColumn items={days} index={d - 1} onChange={(i) => set(y, m, i + 1)} flex={0.7} />
        <WheelColumn items={MONTHS} index={m} onChange={(i) => set(y, i, d)} flex={1.6} />
        <WheelColumn items={years.map(String)} index={Math.max(years.indexOf(y), 0)} onChange={(i) => set(years[i], m, d)} flex={1} />
      </View>
      <Pressable style={[s.saveBtn, { backgroundColor: C.primary, marginTop: 16 }]} onPress={onClose}><Text style={s.saveBtnText}>Listo</Text></Pressable>
    </BottomSheet>
  );
}

// Meses sin intereses: la compra se divide en pagos mensuales iguales
function MsiSheet({ visible, onClose, value, onApply, amount }) {
  const [n, setN] = useState(value || 6);
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Meses sin intereses" subtitle="¿A cuántos meses?">
      <View style={s.chipsRow}>
        {MSI_OPTS.map((k) => (
          <Pressable key={k} onPress={() => setN(k)} style={[s.msiChip, n === k && s.fChipOn]}><Text style={[s.fChipText, { fontWeight: '600' }, n === k && { color: '#fff' }]}>{k}</Text></Pressable>
        ))}
      </View>
      <View style={s.stepperBig}>
        <Pressable style={s.stepBig} onPress={() => setN(Math.max(2, n - 1))}><Text style={s.stepBigText}>−</Text></Pressable>
        <Text style={[s.body, { fontWeight: '600', fontSize: 18 }]}>{n} meses</Text>
        <Pressable style={s.stepBig} onPress={() => setN(Math.min(48, n + 1))}><Text style={s.stepBigText}>+</Text></Pressable>
      </View>
      {amount > 0 && <Text style={[s.balanceSub, { textAlign: 'center', fontSize: 15 }]}>{money(round2(amount / n), true)} al mes durante {n} meses</Text>}
      <Pressable style={[s.saveBtn, { backgroundColor: C.primary, marginTop: 14 }]} onPress={() => onApply(n)}><Text style={s.saveBtnText}>Poner a {n} meses</Text></Pressable>
      {!!value && <Pressable onPress={() => onApply(null)} style={{ marginTop: 14 }}><Text style={[s.link, { textAlign: 'center', color: C.red }]}>Quitar meses sin intereses</Text></Pressable>}
    </BottomSheet>
  );
}

// Adelantar mensualidades de una compra a meses sin intereses: se pagan hoy las últimas y la compra termina antes
function AdvanceSheet({ visible, onClose, move, onApply }) {
  const pending = msiPending(move);
  const [k, setK] = useState(1);
  const plan = msiAdvance(move, k);
  const all = plan.left === 0;
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Adelantar pagos" subtitle={pending.length + (pending.length === 1 ? ' mensualidad pendiente' : ' mensualidades pendientes') + ' de ' + money(move.amount, true)}>
      <View style={s.stepperBig}>
        <Pressable style={s.stepBig} onPress={() => setK(Math.max(1, k - 1))} accessibilityLabel="Menos"><Text style={s.stepBigText}>−</Text></Pressable>
        <Text style={[s.body, { fontWeight: '600', fontSize: 18 }]}>{k} {k === 1 ? 'mensualidad' : 'mensualidades'}</Text>
        <Pressable style={s.stepBig} onPress={() => setK(Math.min(pending.length, k + 1))} accessibilityLabel="Más"><Text style={s.stepBigText}>+</Text></Pressable>
      </View>
      <Text style={[s.balanceSub, { textAlign: 'center', fontSize: 15 }]}>
        {all ? 'Liquidas la compra hoy' : 'Te quedan ' + plan.left + (plan.left === 1 ? ' mensualidad' : ' mensualidades') + ', la última el ' + shortDate(plan.ends)}
      </Text>
      <Pressable style={[s.saveBtn, { backgroundColor: C.primary, marginTop: 14 }]} onPress={() => onApply(k)}><Text style={s.saveBtnText}>Pagar hoy {money(plan.amount, true)}</Text></Pressable>
      {!all && <Pressable onPress={() => setK(pending.length)} style={{ marginTop: 14 }}><Text style={[s.link, { textAlign: 'center' }]}>Liquidar todo ({money(msiAdvance(move, pending.length).amount, true)})</Text></Pressable>}
    </BottomSheet>
  );
}

// Elegir la cuenta del movimiento: cada cuenta con su saldo (en crédito, lo disponible) y "Sin cuenta"
function AccountPickSheet({ visible, title, accounts, selected, onPick, onClose, moves, transfers }) {
  const info = (a) => {
    const b = accountBalance(a, moves, transfers);
    if (!isCredit(a)) return 'Saldo ' + money(b.balance, true);
    return b.available != null ? 'Disponible ' + money(b.available, true) : 'Debes ' + money(b.debt, true);
  };
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
        {accounts.map((a, i) => (
          <Pressable key={a.id} style={[s.row, { paddingHorizontal: 0, paddingVertical: 14 }, i > 0 && s.sep]} onPress={() => onPick(a.id)}>
            <Text style={{ fontSize: 24, marginRight: 12 }}>{ACCOUNT_TYPES[a.type].icon}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.body, { fontSize: 18 }]} numberOfLines={1}>{a.name}{a.last4 ? ' •••• ' + a.last4 : ''}</Text>
              <Text style={[s.balanceSub, { marginTop: 2 }]} numberOfLines={1}>{ACCOUNT_TYPES[a.type].label} · {info(a)}</Text>
            </View>
            {selected === a.id && <Text style={{ color: C.link, fontSize: 20 }}>✓</Text>}
          </Pressable>
        ))}
        <Pressable style={[s.row, s.sep, { paddingHorizontal: 0, paddingVertical: 14 }]} onPress={() => onPick(null)}>
          <Text style={[s.body, { flex: 1, fontSize: 18, color: C.muted }]}>Sin cuenta</Text>
          {!selected && <Text style={{ color: C.link, fontSize: 20 }}>✓</Text>}
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

// Ventana desde abajo con todas las categorías del tipo elegido (en orden alfabético)
function AllCats({ visible, cats, selected, onPick, onClose }) {
  const sorted = [...cats].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Todas tus categorías">
      <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
        <View style={s.catGrid}>
          {sorted.map((c) => (
            <Pressable key={c.name} style={s.catCell} onPress={() => onPick(c.name)}>
              <View style={[s.catIcon, selected === c.name && s.catIconOn]}><Text style={{ fontSize: 28 }}>{c.icon}</Text></View>
              <Text style={[s.catLabel, selected === c.name && { color: C.text, fontWeight: '600' }]} numberOfLines={1}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

// Pantalla para registrar un movimiento nuevo o editar uno existente (edit).
// Quien la usa le pone un `key` distinto cada vez que se abre, así arranca con los valores de `edit`.
export function AddMovementSheet({ visible, onClose, onAdd, onUpdate, onDelete, edit, moves, goals = [], accounts = [], transfers = [] }) {
  const insets = useSafeAreaInsets();
  const now = new Date();
  const startKind = edit ? (edit.kind === 'income' ? 'income' : KEPT.includes(edit.cat) ? 'saving' : 'expense') : 'expense';
  const [kind, setKind] = useState(startKind);
  const [amount, setAmount] = useState(edit ? String(edit.amount) : '');
  const [cat, setCat] = useState(edit && edit.kind === 'expense' ? edit.cat : edit && INCOME_CATS.some((c) => c.name === edit.note) ? edit.note : startKind === 'saving' ? 'Ahorro' : '');
  const [goalId, setGoalId] = useState(edit ? edit.goal_id || null : null);
  const [note, setNote] = useState(edit && !(edit.kind === 'income' && INCOME_CATS.some((c) => c.name === edit.note)) ? edit.note || '' : '');
  const [freq, setFreq] = useState(edit ? edit.freq || 'once' : 'once');
  const editDate = edit ? new Date(edit.occurred_at) : now;
  const [wday, setWday] = useState(edit && edit.freq === 'weekly' && edit.day != null ? edit.day : editDate.getDay());
  const [mday, setMday] = useState(edit && edit.freq === 'monthly' && edit.day != null ? edit.day : editDate.getDate());
  const [date, setDateRaw] = useState(midnight(editDate));
  const [touchedDate, setTouchedDate] = useState(false);
  const [msi, setMsi] = useState(null); // meses sin intereses (solo gastos nuevos)
  // Cuenta con la que se pagó: la del movimiento que se edita o, en uno nuevo, la última que usaste
  const [accountId, setAccountId] = useState(() => {
    if (edit) return edit.account_id || null;
    const last = (moves || []).find((m) => m.account_id && accounts.some((a) => a.id === m.account_id && !a.archived));
    return last ? last.account_id : null;
  });
  const [sheet, setSheet] = useState(null); // 'date' | 'repeat' | 'msi' | 'cats' | 'account' | 'advance'
  const [error, setError] = useState('');
  const [pad, setPad] = useState(false); // teclado numérico: oculto hasta que tocas el monto
  const openPad = () => { Keyboard.dismiss(); setPad(true); };

  const isIncome = kind === 'income', isSaving = kind === 'saving';
  const pool = isIncome ? INCOME_CATS : isSaving ? SAVE_CATS : SPEND_CATS;
  // Las 5 categorías que más usas de este tipo (para que estén a un toque)
  const quick = useMemo(() => {
    if (isSaving) return SAVE_CATS;
    const count = {};
    (moves || []).forEach((m) => {
      const k = m.kind === 'income' ? (isIncome ? m.note : null) : (!isIncome ? m.cat : null);
      if (k && pool.some((c) => c.name === k)) count[k] = (count[k] || 0) + 1;
    });
    const rank = (name) => { const i = DEFAULT_ORDER.indexOf(name); return i < 0 ? 99 : i; };
    const order = [...pool].sort((a, b) => (count[b.name] || 0) - (count[a.name] || 0) || rank(a.name) - rank(b.name));
    const top = order.slice(0, 5);
    const sel = pool.find((c) => c.name === cat);
    return sel && !top.includes(sel) ? [...top.slice(0, 4), sel] : top;
  }, [moves, isIncome, isSaving, pool, cat]);
  const left = useMemo(() => periodView(moves || [], 'monthly', new Date()).left, [moves]);
  const suggestion = useMemo(() => (!edit && kind === 'expense' ? suggestFromNote(moves || [], note) : null), [note, edit, kind, moves]);
  const sugCat = suggestion ? CATS.find((c) => c.name === suggestion.cat) : null;
  const activeGoals = goals.filter((g) => (moves || []).filter((m) => m.goal_id === g.id).reduce((a, m) => a + m.amount, 0) < g.target || g.id === goalId);

  const switchKind = (k) => {
    setKind(k); setError('');
    setCat(k === 'saving' ? 'Ahorro' : ''); setGoalId(null);
  };
  // A meses sin intereses solo se puede pagar con tarjeta de crédito
  const payAccounts = accounts.filter((a) => (!a.archived && (!msi || isCredit(a))) || a.id === (edit && edit.account_id));
  const account = accounts.find((a) => a.id === accountId) || null;
  const applyMsi = (v) => { setMsi(v); if (v && account && !isCredit(account)) setAccountId(null); setSheet(null); };
  const pickCat = (name) => { setCat(name); setError(''); setSheet(null); };
  const setDate = (d) => { setTouchedDate(true); setDateRaw(midnight(d)); };

  // Hoy guarda la hora actual; otro día se guarda a mediodía
  const when = () => {
    if (edit && !touchedDate) return edit.occurred_at;
    if (sameDay(date, now)) return new Date().toISOString();
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).toISOString();
  };
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const dateLabel = sameDay(date, now) ? 'Hoy' : sameDay(date, yesterday) ? 'Ayer'
    : date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });

  const n = parseFloat(amount) || 0;
  const save = async () => {
    if (!(n > 0)) { setError('Escribe un monto mayor a $0.'); openPad(); return; }
    if (kind === 'expense' && !cat) { setError('Elige una categoría.'); return; }
    if (msi && kind === 'expense' && round2(n / msi) < 0.01) { setError('El monto es muy chico para dividirlo en ' + msi + ' meses.'); return; }
    const day = freq === 'weekly' ? wday : freq === 'monthly' ? mday : null;
    let common = { amount: n, freq, day, occurred_at: when() };
    // Meses sin intereses: un pago mensual igual, del mes de la compra hasta el último mes
    if (msi && kind === 'expense') {
      const last = new Date(date.getFullYear(), date.getMonth() + msi - 1, 1);
      const end = new Date(last.getFullYear(), last.getMonth(), Math.min(date.getDate(), daysIn(last.getFullYear(), last.getMonth())));
      common = { amount: round2(n / msi), freq: 'monthly', day: date.getDate(), occurred_at: when(), ends_at: isoLocal(end) };
    }
    common.account_id = account ? account.id : null;
    const goal = goals.find((g) => g.id === goalId);
    const patch = isIncome
      ? { ...common, note: note.trim() || cat || 'Ingreso' }
      : { ...common, cat, note: (msi ? (note.trim() ? note.trim() + ' · ' : 'Compra a ') + msi + ' MSI' : note.trim()) || (goal ? 'Aporte · ' + goal.name : null), goal_id: isSaving ? goalId : null };
    if (common.freq === 'once') patch.ends_at = null;
    if (edit) { if (await onUpdate(edit.id, patch)) onClose(); return; }
    if (await onAdd({ kind: isIncome ? 'income' : 'expense', ...patch })) { Keyboard.dismiss(); onClose(); }
  };
  const endIt = async () => { if (await onUpdate(edit.id, { ends_at: isoLocal(new Date()) })) onClose(); };
  const reactivate = async () => { if (await onUpdate(edit.id, { ends_at: null })) onClose(); };
  const remove = () => { onDelete(edit.id); onClose(); };
  // Adelanto MSI: la compra termina antes y lo adelantado se registra hoy como un gasto aparte de la misma categoría
  const pendingMsi = edit ? msiPending(edit).length : 0;
  const advance = async (k) => {
    const plan = msiAdvance(edit, k);
    if (!plan.count) return;
    if (!(await onUpdate(edit.id, { ends_at: isoLocal(plan.ends) }))) return;
    const what = plan.count === 1 ? '1 mensualidad' : plan.count + ' mensualidades';
    await onAdd({ kind: 'expense', cat: edit.cat, account_id: edit.account_id || null, amount: plan.amount, freq: 'once', day: null, ends_at: null, occurred_at: new Date().toISOString(), note: 'Adelanto · ' + moveTitle(edit) + ' · ' + what });
    onClose();
  };

  const [int, dec] = amount.split('.');
  const recurring = freq !== 'once';
  const saveLabel = !(n > 0) ? 'Escribe un monto' : (edit ? 'Guardar cambios' : 'Guardar ' + TABS[kind].label.toLowerCase()) + ' · ' + money(n, true);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.addScreen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <View style={s.addHead}>
          <Pressable style={s.avatar} onPress={onClose} accessibilityLabel="Cerrar"><Icon name="x" size={22} /></Pressable>
          <Text style={s.addTitle}>{edit ? 'Editar movimiento' : 'Nuevo movimiento'}</Text>
        </View>
        {!edit && <Segmented options={TABS} value={kind} onChange={switchKind} style={s.segCard} />}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => (pad ? setPad(false) : openPad())} accessibilityLabel="Escribir el monto">
            <Text style={[s.addAmount, !amount && !pad && { color: C.muted }]} numberOfLines={1} adjustsFontSizeToFit>
              <Text style={s.addDollar}>$</Text>{commas(int || '0')}{amount.includes('.') ? '.' + (dec || '') : ''}{pad && <Text style={{ color: C.link, fontWeight: '300' }}>|</Text>}
            </Text>
            {!pad && <Text style={[s.balanceSub, { textAlign: 'center', marginTop: 0, marginBottom: 8 }]}>{amount ? 'Toca para cambiar el monto' : 'Toca para escribir el monto'}</Text>}
          </Pressable>
          {!!error && <Text style={[s.hint, { color: C.red, marginTop: 0 }]}>{error}</Text>}
          {/* Cuenta del movimiento: arriba y siempre a la vista */}
          {payAccounts.length > 0 && (
            <Pressable onPress={() => setSheet('account')} style={[s.fChip, s.optChip, { alignSelf: 'center', marginTop: 0, marginBottom: 8 }, account && { borderColor: C.link }]} accessibilityLabel="Elegir cuenta">
              <Text style={[s.fChipText, account && { fontWeight: '600' }]} numberOfLines={1}>
                {(isIncome ? 'Entra a ' : 'Desde ') + (account ? ACCOUNT_TYPES[account.type].icon + ' ' + account.name + (account.last4 ? ' ' + account.last4 : '') : 'ninguna cuenta')}
              </Text>
              <Icon name="chevronDown" size={16} color={C.muted} />
            </Pressable>
          )}
          {!error && (
            <View style={s.leftPill}>
              <Text style={s.leftPillText}>{left >= 0 ? 'Este mes te quedan ' + money(left, true) : 'Este mes vas ' + money(-left, true) + ' arriba'}</Text>
            </View>
          )}

          {isSaving ? (
            <>
              <View style={s.chipsRow}>
                {SAVE_CATS.map((c) => <Pressable key={c.name} onPress={() => pickCat(c.name)} style={[s.fChip, cat === c.name && s.fChipOn]}><Text style={[s.fChipText, cat === c.name && { color: '#fff', fontWeight: '600' }]}>{c.icon} {c.name}</Text></Pressable>)}
              </View>
              <View style={s.chipsRow}>
                <Pressable onPress={() => setGoalId(null)} style={[s.fChip, !goalId && s.fChipOn]}><Text style={[s.fChipText, !goalId && { color: '#fff', fontWeight: '600' }]}>Sin meta</Text></Pressable>
                {activeGoals.map((g) => <Pressable key={g.id} onPress={() => setGoalId(g.id)} style={[s.fChip, goalId === g.id && s.fChipOn]}><Text style={[s.fChipText, goalId === g.id && { color: '#fff', fontWeight: '600' }]}>🎯 {g.name}</Text></Pressable>)}
              </View>
            </>
          ) : (
            <View style={s.quickRow}>
              {quick.map((c) => (
                <Pressable key={c.name} style={s.quickCell} onPress={() => pickCat(c.name)}>
                  <View style={[s.catIcon, cat === c.name && s.catIconOn]}><Text style={{ fontSize: 28 }}>{c.icon}</Text></View>
                  <Text style={[s.catLabel, cat === c.name && { color: C.text, fontWeight: '600' }]} numberOfLines={1}>{c.name}</Text>
                </Pressable>
              ))}
              <Pressable style={s.quickCell} onPress={() => setSheet('cats')}>
                <View style={[s.catIcon, s.catMore]}><Text style={{ fontSize: 22, color: C.text }}>•••</Text></View>
                <Text style={s.catLabel}>Más</Text>
              </Pressable>
            </View>
          )}

          <View style={[s.chipsRow, { alignItems: 'center' }]}>
            <Pressable onPress={() => setSheet('date')} style={[s.fChip, s.optChip]}>
              <Text style={s.fChipText}>{recurring || msi ? 'Desde ' + dateLabel.toLowerCase() : dateLabel}</Text><Icon name="chevronDown" size={16} color={C.muted} />
            </Pressable>
            {kind === 'expense' && !edit && !recurring && (
              <Pressable onPress={() => setSheet('msi')} style={[s.fChip, msi && s.fChipOn]}>
                <Text style={[s.fChipText, msi && { color: '#fff', fontWeight: '600' }]}>{msi ? msi + ' MSI' + (n > 0 ? ' · ' + money(round2(n / msi), true) + '/mes' : '') : '+ Meses sin intereses'}</Text>
              </Pressable>
            )}
            {!msi && (
              <Pressable onPress={() => setSheet('repeat')} style={[s.fChip, recurring && s.fChipOn]}>
                <Text style={[s.fChipText, recurring && { color: '#fff', fontWeight: '600' }]}>{recurring ? REPEATS[freq] + (freq === 'monthly' ? ' · día ' + mday : freq === 'weekly' ? ' · ' + DAYS[wday] : '') : '+ Se repite'}</Text>
              </Pressable>
            )}
          </View>

          {!!account && isCredit(account) && account.credit_limit > 0 && kind === 'expense' && !edit && n > 0 && (
            <Text style={[s.balanceSub, { marginTop: 8 }]}>Te quedarían {money(accountBalance(account, moves || [], transfers).available - n, true)} de crédito disponible en {account.name}</Text>
          )}

          <TextInput style={[s.input, { backgroundColor: C.card, marginTop: 12 }]} placeholder={isIncome ? '¿De dónde vino? (opcional)' : '¿En qué fue? (opcional)'} placeholderTextColor={C.muted} value={note} onChangeText={setNote} maxLength={80} returnKeyType="done" onFocus={() => setPad(false)} />
          {!!suggestion && (suggestion.cat !== cat || (suggestion.amount && !amount)) && (
            <Pressable onPress={() => { setCat(suggestion.cat); setError(''); if (!amount && suggestion.amount) setAmount(String(suggestion.amount)); }} style={[s.fChip, { alignSelf: 'flex-start', backgroundColor: C.hero, borderColor: C.hero }]}>
              <Text style={[s.fChipText, { color: C.link }]}>💡 {sugCat ? sugCat.icon : ''} {suggestion.cat}{suggestion.amount ? ' · ' + money(suggestion.amount) : ''}{suggestion.source === 'historial' ? ' (como la última vez)' : ''}</Text>
            </Pressable>
          )}

          {!!edit && (
            <View style={[s.chipsRow, { marginTop: 4 }]}>
              {pendingMsi > 0 && <Pressable onPress={() => setSheet('advance')} style={s.fChip}><Text style={[s.fChipText, { color: C.link }]}>Adelantar pagos ({pendingMsi} {pendingMsi === 1 ? 'pendiente' : 'pendientes'})</Text></Pressable>}
              {edit.freq && edit.freq !== 'once' && (edit.ends_at
                ? <Pressable onPress={reactivate} style={s.fChip}><Text style={[s.fChipText, { color: C.link }]}>Reactivar (terminó el {parseDay(edit.ends_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })})</Text></Pressable>
                : <Pressable onPress={endIt} style={s.fChip}><Text style={[s.fChipText, { color: C.link }]}>{isIncome ? 'Terminar este ingreso' : 'Terminar este pago'}</Text></Pressable>)}
              <Pressable onPress={remove} style={s.fChip}><Text style={[s.fChipText, { color: C.red }]}>Borrar movimiento</Text></Pressable>
            </View>
          )}
        </ScrollView>

        {pad && (
          <>
            <Pressable onPress={() => setPad(false)} hitSlop={10} style={{ alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 4 }} accessibilityLabel="Ocultar teclado">
              <Text style={[s.link, { fontWeight: '600' }]}>Listo</Text>
            </Pressable>
            <View style={s.keypad}>
              {KEYS.map((k) => (
                <Pressable key={k} style={[s.key, (k === '.' || k === 'del') && s.keyFlat]} onPress={() => { setAmount((a) => press(a, k)); setError(''); }} accessibilityLabel={k === 'del' ? 'Borrar' : k}>
                  {k === 'del' ? <Text style={s.keyText}>⌫</Text> : <Text style={s.keyText}>{k}</Text>}
                </Pressable>
              ))}
            </View>
          </>
        )}
        <Pressable style={[s.saveBtn, n > 0 && { backgroundColor: C.primary }]} onPress={save}>
          <Text style={[s.saveBtnText, !(n > 0) && { color: C.muted }]}>{saveLabel}</Text>
        </Pressable>
      </View>
      {sheet === 'account' && (
        <AccountPickSheet visible title={isIncome ? '¿A qué cuenta entró?' : isSaving ? '¿De qué cuenta salió?' : msi ? '¿Con qué tarjeta?' : '¿Con qué pagaste?'} accounts={payAccounts} selected={accountId}
          moves={moves || []} transfers={transfers} onPick={(id) => { setAccountId(id); setSheet(null); }} onClose={() => setSheet(null)} />
      )}
      <AllCats visible={sheet === 'cats'} cats={pool} selected={cat} onPick={pickCat} onClose={() => setSheet(null)} />
      <DateSheet visible={sheet === 'date'} onClose={() => setSheet(null)} date={date} setDate={setDate} />
      <RepeatSheet visible={sheet === 'repeat'} onClose={() => setSheet(null)} freq={freq} setFreq={setFreq} wday={wday} setWday={setWday} mday={mday} setMday={setMday} isIncome={isIncome} />
      {sheet === 'msi' && <MsiSheet visible onClose={() => setSheet(null)} value={msi} amount={n} onApply={applyMsi} />}
      {sheet === 'advance' && <AdvanceSheet visible onClose={() => setSheet(null)} move={edit} onApply={(k) => { setSheet(null); advance(k); }} />}
    </Modal>
  );
}
