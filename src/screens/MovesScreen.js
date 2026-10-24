import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Switch } from 'react-native';
import { Amount } from '../components/HomeCards';
import { Icon } from '../components/Icon';
import { MonthNav } from '../components/MonthNav';
import { SwipeRow } from '../components/SwipeRow';
import { BUCKETS, CATS } from '../constants/budget';
import { endOfDay, startOfMonth } from '../lib/dates';
import { asExp, bucketOf, isActive, isRecurring, moveTitle, occurrenceDates, parseDay, titleIsCat } from '../lib/finance';
import { cleanAmount, money, shortDate } from '../lib/format';
import { KEPT } from '../lib/summary';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

const KINDS = { all: 'Todo', expense: 'Gastos', income: 'Ingresos' };
const SORTS = { new: 'Más recientes', old: 'Más antiguos', high: 'Más caros', low: 'Más baratos' };
const RANGES = { month: 'Todo el mes', '7d': 'Últimos 7 días', '30d': 'Últimos 30 días' };
const ORIGINS = { all: 'De todos lados', recurring: 'Recurrentes', once: 'Una sola vez' };
const DEFAULTS = { kind: 'all', cat: null, min: '', max: '', sort: 'new', range: 'month', origin: 'all', onlySaved: false };

// Etiqueta de día para agrupar la lista: Hoy, Ayer o la fecha
function dayLabel(d, now) {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()), b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((b - a) / 864e5);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  const x = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
  return x.charAt(0).toUpperCase() + x.slice(1);
}

const Pill = ({ label, on, onPress }) => (
  <Pressable onPress={onPress} style={[s.fChip, on && s.fChipOn]}><Text style={[s.fChipText, on && { color: '#fff', fontWeight: '600' }]}>{label}</Text></Pressable>
);

// Movimientos de un mes: cada pago recurrente aparece en cada día en que ocurre.
// Lo que ya pasó se agrupa por día; lo que aún no llega va en "Programados este mes".
export function MovesScreen({ moves, loading, onDelete, onEdit, initialDay }) {
  const now = new Date();
  // Si se llega desde el calendario del Resumen, abre en ese día
  const [month, setMonth] = useState(() => startOfMonth(initialDay ? parseDay(initialDay) : now));
  const [day, setDay] = useState(initialDay || null);
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
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

  const filterCount = ['kind', 'cat', 'min', 'max', 'sort', 'range', 'origin', 'onlySaved'].filter((k) => f[k] !== DEFAULTS[k] && k !== 'kind').length;
  const clear = () => { setF(DEFAULTS); setQ(''); setDay(null); };

  // Una fila: tocar abre la edición; deslizar a la izquierda borra
  const row = (x, i) => {
    const { m } = x;
    const isInc = m.kind === 'income', kept = KEPT.includes(m.cat), c = CATS.find((z) => z.name === m.cat), b = BUCKETS[bucketOf(m.cat)];
    const ended = isRecurring(m) && !isActive(m, now);
    const color = isInc ? C.green : kept ? '#A78BFA' : C.text;
    const sub = [isInc ? 'Ingreso' : !titleIsCat(m) ? m.cat : b.label, isRecurring(m) ? 'Recurrente' : null, !byDate ? shortDate(x.at) : null].filter(Boolean).join(' · ');
    return (
      <SwipeRow key={x.key} first={i === 0} onDelete={() => onDelete(m.id)}>
        <Pressable style={[s.row, { paddingVertical: 14 }, ended && { opacity: 0.5 }]} onPress={() => onEdit(m)}>
          <View style={s.iconBox}><Text style={{ fontSize: 22 }}>{isInc ? '💼' : c ? c.icon : '🧾'}</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.body, { fontWeight: '600' }]} numberOfLines={1}>{moveTitle(m)}</Text>
            <Text style={[s.balanceSub, { marginTop: 2 }]} numberOfLines={1}>{sub}</Text>
          </View>
          <Amount value={isInc ? m.amount : -m.amount} size={18} color={color} plus />
        </Pressable>
      </SwipeRow>
    );
  };

  const net = (items) => items.reduce((a, x) => a + (x.m.kind === 'income' ? x.m.amount : -x.m.amount), 0);

  return (
    <>
      <View style={s.screenHead}>
        <Text style={s.screenTitle}>Movimientos</Text>
        <View style={s.headerRight}>
          <Pressable style={[s.avatar, (searching || !!q) && { backgroundColor: C.raisedHi }]} onPress={() => setSearching(!searching)} accessibilityLabel="Buscar"><Icon name="search" size={22} /></Pressable>
          <Pressable style={[s.avatar, (panel || filterCount > 0) && { backgroundColor: C.raisedHi }]} onPress={() => setPanel(!panel)} accessibilityLabel="Filtros">
            <Icon name="filter" size={22} color={filterCount > 0 ? C.link : '#fff'} />
            {filterCount > 0 && <View style={s.badge}><Text style={s.badgeText}>{filterCount}</Text></View>}
          </Pressable>
        </View>
      </View>
      {(searching || !!q) && <TextInput style={[s.input, { backgroundColor: C.card }]} placeholder="Buscar categoría o concepto" placeholderTextColor={C.muted} value={q} onChangeText={setQ} autoFocus={searching && !q} />}

      <MonthNav month={month} onMonth={pickMonth} min={oldest} max={new Date(now.getFullYear() + 1, now.getMonth(), 1)} />

      <View style={[s.chipsRow, { marginTop: 4 }]}>
        {Object.entries(KINDS).map(([k, label]) => <Pill key={k} label={label} on={f.kind === k} onPress={() => set({ kind: k, onlySaved: k === 'income' ? false : f.onlySaved })} />)}
        {!!dayDate && (
          <Pressable onPress={() => setDay(null)} style={[s.fChip, s.fChipOn, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
            <Text style={[s.fChipText, { color: '#fff', fontWeight: '600' }]}>{shortDate(dayDate)}</Text><Icon name="x" size={14} />
          </Pressable>
        )}
      </View>

      {panel && (
        <View style={[s.card, { padding: 16 }]}>
          <Pressable style={[s.balanceHead, { marginBottom: 0 }]} onPress={() => setShowCats(!showCats)}>
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

          <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18 }} onPress={() => setMore(!more)}>
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
            <Pressable style={[s.btnGhost, { flex: 1 }]} onPress={clear}><Text style={[s.btnText, { color: C.muted }]}>Limpiar</Text></Pressable>
            <Pressable style={[s.btnPrimary, { flex: 1.6 }]} onPress={() => setPanel(false)}><Text style={s.btnText}>Listo</Text></Pressable>
          </View>
        </View>
      )}

      <Text style={[s.balanceSub, { paddingHorizontal: 4, fontSize: 15 }]}>{shown.length} de {all.length} movimientos</Text>

      {scheduled.length > 0 && (
        <View style={[s.card, { borderWidth: 1, borderColor: C.border }]}>
          <Pressable style={[s.row, { paddingVertical: 14 }]} onPress={() => setShowSched(!showSched)}>
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
              {row(x, 1 + i)}
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
            <View style={[s.balanceHead, { marginTop: 20, marginBottom: 0, paddingHorizontal: 6 }]}>
              <Text style={[s.body, { fontWeight: '600' }]}>{g.label}</Text>
              {byDate && <Text style={[s.body, { fontWeight: '600', color: n >= 0 ? C.green : C.text }]}>{n >= 0 ? '+' : '-'}{money(Math.abs(n))}</Text>}
            </View>
            <View style={[s.card, { marginTop: 8 }]}>{g.items.map(row)}</View>
          </React.Fragment>
        );
      })}

      {(filterCount > 0 || q || day) ? <Pressable onPress={clear}><Text style={[s.link, { textAlign: 'center', marginTop: 16 }]}>Quitar filtros</Text></Pressable>
        : moves.length > 0 && <Text style={s.hint}>Toca un movimiento para editarlo o desliza a la izquierda para borrarlo.</Text>}
    </>
  );
}
