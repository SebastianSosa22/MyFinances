import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Switch } from 'react-native';
import { Icon } from '../components/Icon';
import { MonthSwitch } from '../components/ui';
import { SwipeRow } from '../components/SwipeRow';
import { BUCKETS, CATS, EFREQ } from '../constants/budget';
import { endOfDay, startOfMonth } from '../lib/dates';
import { ACCOUNT_TYPES } from '../lib/accounts';
import { asExp, bucketOf, isActive, isRecurring, moveTitle, occurrenceDates, parseDay, titleIsCat } from '../lib/finance';
import { cleanAmount, money, shortDate } from '../lib/format';
import { KEPT } from '../lib/summary';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

const KINDS = { all: 'Todo', expense: 'Gastos', income: 'Ingresos' };
// Fondo del ícono según la parte del presupuesto (Necesidades azul, Deseos ámbar, Ahorro/ingreso menta)
const SOFT = { needs: '#1B2A44', wants: '#3A2A16', savings: '#13362A' };
const SORTS = { new: 'Más recientes', old: 'Más antiguos', high: 'Más caros', low: 'Más baratos' };
const RANGES = { month: 'Todo el mes', '7d': 'Últimos 7 días', '30d': 'Últimos 30 días' };
const ORIGINS = { all: 'De todos lados', recurring: 'Recurrentes', once: 'Una sola vez' };
const DEFAULTS = { kind: 'all', account: null, cat: null, min: '', max: '', sort: 'new', range: 'month', origin: 'all', onlySaved: false };

// Etiqueta de día para agrupar la lista: Hoy, Ayer o la fecha
function dayLabel(d, now) {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()), b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((b - a) / 864e5);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  const x = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
  return x.charAt(0).toUpperCase() + x.slice(1);
}

const Pill = ({ label, on, onPress }) => (
  <Pressable accessibilityRole="button" accessibilityState={{ selected: !!on }} onPress={onPress} style={[s.fChip, on && s.fChipOn]}><Text style={[s.fChipText, on && { color: C.onPrimary, fontWeight: '600' }]}>{label}</Text></Pressable>
);

// Movimientos de un mes: cada pago recurrente aparece en cada día en que ocurre.
// Lo que ya pasó se agrupa por día; lo que aún no llega va en "Programados este mes".
export function MovesScreen({ moves, accounts = [], loading, onDelete, onEdit, initialDay }) {
  const now = new Date();
  // Si se llega desde el calendario del Resumen, abre en ese día
  const [month, setMonth] = useState(() => startOfMonth(initialDay ? parseDay(initialDay) : now));
  const [day, setDay] = useState(initialDay || null);
  const [q, setQ] = useState('');
  const [panel, setPanel] = useState(false);
  const [more, setMore] = useState(false);
  const [f, setF] = useState(DEFAULTS);
  const [showCats, setShowCats] = useState(false);
  const [showSched, setShowSched] = useState(false);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));

  const first = moves.reduce((a, m) => Math.min(a, new Date(m.occurred_at).getTime()), Infinity);
  const oldest = startOfMonth(Number.isFinite(first) && first < now.getTime() ? new Date(first) : now);
  const from = startOfMonth(month), to = endOfDay(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const dayDate = day ? parseDay(day) : null;
  const pickMonth = (d) => { setMonth(d); setDay(null); };

  // 1) Cada ocurrencia del mes (los recurrentes cuentan cada vez que tocan)
  const all = [];
  moves.forEach((m) => occurrenceDates(asExp(m), from, to).forEach((d) => {
    const at = isRecurring(m) ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12) : new Date(m.occurred_at);
    all.push({ m, at, key: m.id + '-' + d.getTime() });
  }));

  // 2) Filtros
  const ql = q.trim().toLowerCase();
  const minV = Number(f.min) || 0, maxV = Number(f.max) || 0;
  const since = f.range === '7d' ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6) : f.range === '30d' ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29) : null;
  const shown = all.filter(({ m, at }) => {
    if (f.kind !== 'all' && m.kind !== f.kind) return false;
    if (f.cat && (m.kind === 'income' || m.cat !== f.cat)) return false;
    if (f.account && (f.account === 'none' ? !!m.account_id : m.account_id !== f.account)) return false;
    if (f.onlySaved && !(m.kind === 'expense' && KEPT.includes(m.cat))) return false;
    if (f.origin === 'recurring' && !isRecurring(m)) return false;
    if (f.origin === 'once' && isRecurring(m)) return false;
    if (minV && m.amount < minV) return false;
    if (maxV && m.amount > maxV) return false;
    if (since && at < since) return false;
    if (dayDate && (at < dayDate || at > endOfDay(dayDate))) return false;
    if (ql && !((m.cat || '').toLowerCase().includes(ql) || (m.note || '').toLowerCase().includes(ql))) return false;
    return true;
  });
  const sorters = { new: (a, b) => b.at - a.at, old: (a, b) => a.at - b.at, high: (a, b) => b.m.amount - a.m.amount, low: (a, b) => a.m.amount - b.m.amount };
  shown.sort(sorters[f.sort]);
  const done = shown.filter((x) => x.at <= now);
  const scheduled = shown.filter((x) => x.at > now).sort((a, b) => a.at - b.at);

  // 3) Agrupar por día (solo al ordenar por fecha; por monto se muestra una sola lista)
  const byDate = f.sort === 'new' || f.sort === 'old';
  const groups = [];
  done.forEach((x) => {
    const label = byDate ? dayLabel(x.at, now) : SORTS[f.sort];
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(x); else groups.push({ label, items: [x] });
  });

  const filterCount = ['kind', 'account', 'cat', 'min', 'max', 'sort', 'range', 'origin', 'onlySaved'].filter((k) => f[k] !== DEFAULTS[k] && k !== 'kind').length;
  const clear = () => { setF(DEFAULTS); setQ(''); setDay(null); };

  // Una fila: tocar abre la edición; deslizar a la izquierda borra
  const row = (x, i, card) => {
    const { m } = x;
    const isInc = m.kind === 'income', kept = KEPT.includes(m.cat), c = CATS.find((z) => z.name === m.cat), b = BUCKETS[bucketOf(m.cat)];
    const ended = isRecurring(m) && !isActive(m, now);
    const color = isInc ? C.green : kept ? '#C9A7FF' : C.text;
    const acc = m.account_id && accounts.find((a) => a.id === m.account_id);
    const sub = [isInc ? 'Ingreso' : !titleIsCat(m) ? m.cat : b.label, acc ? acc.name : null, !byDate ? shortDate(x.at) : null].filter(Boolean).join(' · ');
    const soft = isInc ? SOFT.savings : SOFT[bucketOf(m.cat)] || C.raised;
    return (
      <SwipeRow key={x.key} first={i === 0} flat={!card} onDelete={() => onDelete(m.id)}>
        <Pressable accessibilityRole="button" style={[card ? [s.row, { gap: 12 }] : s.listRow, { borderBottomWidth: 0 }, ended && { opacity: 0.5 }]} onPress={() => onEdit(m)}>
          <View style={[s.catBadge, { backgroundColor: soft }]}><Text style={{ fontSize: 18 }}>{isInc ? '💼' : c ? c.icon : '🧾'}</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.rowTitle} numberOfLines={1}>{moveTitle(m)}</Text>
            <Text style={s.rowSub} numberOfLines={1}>{sub}{isRecurring(m) && <Text style={{ color: C.link }}>{sub ? ' · ' : ''}↻ {EFREQ[m.freq] || 'Recurrente'}</Text>}</Text>
          </View>
          <Text style={[s.rowAmount, { color: isInc ? C.green : kept ? color : C.text }]}>{isInc ? '+' : '−'}{money(m.amount)}</Text>
        </Pressable>
      </SwipeRow>
    );
  };

  const totIn = done.reduce((a, x) => a + (x.m.kind === 'income' ? x.m.amount : 0), 0);
  const totOut = done.reduce((a, x) => a + (x.m.kind === 'income' ? 0 : x.m.amount), 0);
  const net = (items) => items.reduce((a, x) => a + (x.m.kind === 'income' ? x.m.amount : -x.m.amount), 0);

  return (
    <>
      <View style={s.screenHead}>
        <Text style={s.screenTitle}>Movimientos</Text>
        <MonthSwitch month={month} onMonth={pickMonth} min={oldest} max={new Date(now.getFullYear() + 1, now.getMonth(), 1)} />
      </View>

      <View style={[s.tileRow, { gap: 8, marginTop: 10 }]}>
        <View style={s.searchBox}>
          <Icon name="search" size={18} color={C.muted} />
          <TextInput style={s.searchField} placeholder="Buscar categoría o concepto" placeholderTextColor={C.muted} value={q} onChangeText={setQ} accessibilityLabel="Buscar" />
        </View>
        <Pressable accessibilityRole="button" style={[s.squareBtn, panel && { borderColor: C.link }]} onPress={() => setPanel(!panel)} accessibilityLabel="Más opciones de filtro">
          <Icon name="filter" size={20} color={filterCount > 0 ? C.link : C.text} />
          {filterCount > 0 && <View style={s.dotBadge} />}
        </Pressable>
      </View>

      <View style={[s.chipsRow, { marginTop: 4 }]}>
        {Object.entries(KINDS).map(([k, label]) => <Pill key={k} label={label} on={f.kind === k && f.origin !== 'recurring'} onPress={() => set({ kind: k, origin: 'all', onlySaved: k === 'income' ? false : f.onlySaved })} />)}
        <Pill label="Recurrentes" on={f.origin === 'recurring'} onPress={() => set({ origin: f.origin === 'recurring' ? 'all' : 'recurring', kind: 'all' })} />
        {!!dayDate && (
          <Pressable accessibilityRole="button" onPress={() => setDay(null)} style={[s.fChip, s.fChipOn, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
            <Text style={[s.fChipText, s.fChipTextOn]}>{shortDate(dayDate)}</Text><Icon name="x" size={14} color={C.onPrimary} />
          </Pressable>
        )}
      </View>

      <View style={[s.tileRow, { marginTop: 14 }]}>
        <View style={[s.statCard, { borderRadius: 16, paddingVertical: 10, gap: 2 }]}>
          <Text style={s.tileLabel}>Entraron</Text>
          <Text style={[s.rowAmount, { fontSize: 17, color: C.green }]} numberOfLines={1}>+{money(Math.round(totIn))}</Text>
        </View>
        <View style={[s.statCard, { borderRadius: 16, paddingVertical: 10, gap: 2 }]}>
          <Text style={s.tileLabel}>Salieron</Text>
          <Text style={[s.rowAmount, { fontSize: 17 }]} numberOfLines={1}>−{money(Math.round(totOut))}</Text>
        </View>
      </View>

      {panel && (
        <View style={[s.card, { padding: 16 }]}>
          {accounts.length > 0 && (
            <>
              <Text style={s.balanceLabel}>Cuenta</Text>
              <View style={[s.chipsRow, { marginBottom: 18 }]}>
                <Pill label="Todas" on={!f.account} onPress={() => set({ account: null })} />
                {accounts.map((a) => <Pill key={a.id} label={ACCOUNT_TYPES[a.type].icon + ' ' + a.name + (a.last4 ? ' ' + a.last4 : '')} on={f.account === a.id} onPress={() => set({ account: a.id })} />)}
                <Pill label="Sin cuenta" on={f.account === 'none'} onPress={() => set({ account: 'none' })} />
              </View>
            </>
          )}
          <Pressable accessibilityRole="button" style={[s.balanceHead, { marginBottom: 0 }]} onPress={() => setShowCats(!showCats)}>
            <Text style={s.body}>Categoría</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text style={s.balanceLabel}>{f.cat || 'Todas'}</Text><Icon name={showCats ? 'chevronUp' : 'chevronDown'} size={18} color={C.muted} /></View>
          </Pressable>
          {showCats && (
            <View style={s.chipsRow}>
              <Pill label="Todas" on={!f.cat} onPress={() => set({ cat: null })} />
              {CATS.map((c) => <Pill key={c.name} label={c.icon + ' ' + c.name} on={f.cat === c.name} onPress={() => set({ cat: c.name, kind: f.kind === 'income' ? 'all' : f.kind })} />)}
            </View>
          )}

          <Text style={[s.balanceLabel, { marginTop: 18 }]}>Monto</Text>
          <View style={[s.btnRow, { marginTop: 8 }]}>
            <TextInput style={[s.input, { flex: 1, flexBasis: 0, minWidth: 0, marginTop: 0 }]} placeholder="Más de $" placeholderTextColor={C.muted} keyboardType="decimal-pad" value={f.min} onChangeText={(t) => set({ min: cleanAmount(t) })} />
            <TextInput style={[s.input, { flex: 1, flexBasis: 0, minWidth: 0, marginTop: 0 }]} placeholder="Menos de $" placeholderTextColor={C.muted} keyboardType="decimal-pad" value={f.max} onChangeText={(t) => set({ max: cleanAmount(t) })} />
          </View>

          <Text style={[s.balanceLabel, { marginTop: 18 }]}>Ordenar</Text>
          <View style={s.chipsRow}>{Object.entries(SORTS).map(([k, label]) => <Pill key={k} label={label} on={f.sort === k} onPress={() => set({ sort: k })} />)}</View>

          <Pressable accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18 }} onPress={() => setMore(!more)}>
            <Text style={[s.link, { fontWeight: '600' }]}>Más opciones</Text><Icon name={more ? 'chevronUp' : 'chevronDown'} size={18} color={C.link} />
          </Pressable>
          {more && (
            <>
              <Text style={[s.balanceLabel, { marginTop: 14 }]}>Fechas dentro del mes</Text>
              <View style={s.chipsRow}>{Object.entries(RANGES).map(([k, label]) => <Pill key={k} label={label} on={f.range === k} onPress={() => set({ range: k })} />)}</View>
              <Text style={[s.balanceLabel, { marginTop: 14 }]}>Tipo de movimiento</Text>
              <View style={s.chipsRow}>{Object.entries(ORIGINS).map(([k, label]) => <Pill key={k} label={label} on={f.origin === k} onPress={() => set({ origin: k })} />)}</View>
              <View style={[s.balanceHead, { marginTop: 14, marginBottom: 0 }]}>
                <Text style={[s.body, { flex: 1 }]}>Solo lo que apartaste para ahorro</Text>
                <Switch value={f.onlySaved} onValueChange={(v) => set({ onlySaved: v, kind: v ? 'expense' : f.kind, cat: v ? null : f.cat })} trackColor={{ true: C.primary, false: C.raised }} thumbColor="#fff" />
              </View>
            </>
          )}

          <View style={s.btnRow}>
            <Pressable accessibilityRole="button" style={[s.btnGhost, { flex: 1 }]} onPress={clear}><Text style={[s.btnText, { color: C.muted }]}>Limpiar</Text></Pressable>
            <Pressable accessibilityRole="button" style={[s.btnPrimary, { flex: 1.6 }]} onPress={() => setPanel(false)}><Text style={s.btnText}>Listo</Text></Pressable>
          </View>
        </View>
      )}


      {scheduled.length > 0 && (
        <View style={s.card}>
          <Pressable accessibilityRole="button" style={[s.row, { paddingVertical: 14 }]} onPress={() => setShowSched(!showSched)}>
            <Icon name="calendar" size={24} color={C.link} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[s.body, { fontWeight: '600' }]}>Programados este mes ({scheduled.length})</Text>
              <Text style={[s.balanceSub, { marginTop: 2 }]}>Aún no contabilizados · {money(Math.abs(net(scheduled)), true)}</Text>
            </View>
            <Icon name={showSched ? 'chevronUp' : 'chevronDown'} size={20} color={C.muted} />
          </Pressable>
          {showSched && scheduled.map((x, i) => (
            <View key={x.key} style={s.sep}>
              <View style={[s.row, { paddingLeft: 70, paddingTop: 10, paddingBottom: 0 }]}><Text style={s.balanceSub}>{dayLabel(x.at, now)}</Text></View>
              {row(x, 1 + i, true)}
            </View>
          ))}
        </View>
      )}

      {loading && moves.length === 0 && <ActivityIndicator style={{ marginTop: 40 }} />}
      {!loading && moves.length === 0 && <View style={[s.card, { padding: 16 }]}><Text style={s.hint}>Aún no hay movimientos. Toca + para agregar el primero.</Text></View>}
      {!loading && moves.length > 0 && shown.length === 0 && <View style={[s.card, { padding: 16 }]}><Text style={[s.hint, { marginTop: 0 }]}>{all.length ? 'Ningún movimiento coincide con los filtros.' : 'No hay movimientos en este mes.'}</Text></View>}

      {groups.map((g) => {
        const n = net(g.items);
        return (
          <React.Fragment key={g.label + g.items[0].key}>
            <View style={s.dayHead}>
              <Text style={s.dayHeadText}>{g.label}</Text>
              {byDate && <Text style={[s.rowAmount, { fontSize: 12, color: n >= 0 ? C.green : C.muted }]}>{n >= 0 ? '+' : '−'}{money(Math.abs(n))}</Text>}
            </View>
            {g.items.map((x, i) => row(x, i, false))}
          </React.Fragment>
        );
      })}

      {(filterCount > 0 || q || day) ? <Pressable accessibilityRole="button" onPress={clear}><Text style={[s.link, { textAlign: 'center', marginTop: 16 }]}>Quitar filtros</Text></Pressable>
        : moves.length > 0 && <Text style={s.hint}>Toca un movimiento para editarlo o desliza a la izquierda para borrarlo.</Text>}
    </>
  );
}
