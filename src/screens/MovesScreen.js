import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { MonthCalendar } from '../components/MonthCalendar';
import { SwipeRow } from '../components/SwipeRow';
import { Card, Segmented, Title } from '../components/ui';
import { BUCKETS, CATS } from '../constants/budget';
import { useWide } from '../hooks/useWide';
import { endOfDay, periodStart, startOfMonth } from '../lib/dates';
import { asExp, bucketOf, freqLabel, isActive, isRecurring, moveTitle, occurrenceDates, parseDay, titleIsCat } from '../lib/finance';
import { isoLocal, money } from '../lib/format';
import { s } from '../theme/styles';

const FACTOR = { weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, yearly: 1 / 12 };

// Etiqueta de día para agrupar la lista: Hoy, Ayer o la fecha
function dayLabel(d, now) {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()), b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((b - a) / 864e5);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
}

export function MovesScreen({ moves, loading, onDelete, onEdit }) {
  const wide = useWide();
  const [q, setQ] = useState('');
  const [fType, setFType] = useState('all');
  const [fRange, setFRange] = useState('all');
  const [fBucket, setFBucket] = useState(null);
  const [fRec, setFRec] = useState(false);
  const [open, setOpen] = useState(false); // panel de filtros en móvil
  const [calMonth, setCalMonth] = useState(() => startOfMonth(new Date()));
  const [selDay, setSelDay] = useState(null); // día elegido en el calendario ('YYYY-MM-DD')
  const now = new Date();

  const ql = q.trim().toLowerCase();
  const shown = moves.filter((m) => {
    if (fType !== 'all' && m.kind !== fType) return false;
    if (fBucket && (m.kind === 'income' || bucketOf(m.cat) !== fBucket)) return false;
    if (fRec && !isRecurring(m)) return false;
    const d = new Date(m.occurred_at);
    if (!isRecurring(m) && fRange === 'month' && d < periodStart('monthly')) return false;
    if (!isRecurring(m) && fRange === '30d' && d < new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)) return false;
    if (ql && !((m.cat || '').toLowerCase().includes(ql) || (m.note || '').toLowerCase().includes(ql))) return false;
    return true;
  });
  // Días del mes del calendario con movimientos (los recurrentes cuentan en cada día que ocurren)
  const calEnd = endOfDay(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0));
  const days = {};
  shown.forEach((m) => occurrenceDates(asExp(m), calMonth, calEnd).forEach((d) => {
    const k = isoLocal(d), x = days[k] || (days[k] = { inc: 0, exp: 0 });
    if (m.kind === 'income') x.inc += m.amount; else x.exp += m.amount;
  }));
  const selDate = selDay ? parseDay(selDay) : null;
  const onSel = (m) => !selDate || occurrenceDates(asExp(m), selDate, endOfDay(selDate)).length > 0;
  const pickMonth = (d) => { setCalMonth(d); setSelDay(null); };

  const fixed = shown.filter((m) => isRecurring(m) && onSel(m));
  const oneOff = shown.filter((m) => !isRecurring(m) && onSel(m));
  const fixedMonthly = fixed.filter((m) => m.kind === 'expense' && isActive(m, now)).reduce((a, m) => a + m.amount * FACTOR[m.freq], 0);
  // Con un día elegido, los totales incluyen los pagos fijos que caen ese día
  const dayTotals = selDay && days[selDay];
  const inc = dayTotals ? dayTotals.inc : oneOff.filter((m) => m.kind === 'income').reduce((a, m) => a + m.amount, 0);
  const exp = dayTotals ? dayTotals.exp : oneOff.filter((m) => m.kind === 'expense').reduce((a, m) => a + m.amount, 0);

  // Movimientos de un solo día agrupados por fecha (ya vienen ordenados de más nuevo a más viejo)
  const groups = [];
  oneOff.forEach((m) => {
    const label = dayLabel(new Date(m.occurred_at), now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(m); else groups.push({ label, items: [m] });
  });

  const filterCount = (fType !== 'all' ? 1 : 0) + (fRange !== 'all' ? 1 : 0) + (fBucket ? 1 : 0) + (fRec ? 1 : 0);
  const active = q || fType !== 'all' || fRange !== 'all' || fBucket || fRec || selDay;
  const clear = () => { setQ(''); setFType('all'); setFRange('all'); setFBucket(null); setFRec(false); setSelDay(null); };
  const idle = wide ? '#1E2736' : '#2A3446';   // el comando de abajo convierte #2A3446 en el gris nuevo
  const search = <TextInput style={[s.input, s.searchInput]} placeholder="Buscar categoría o concepto" value={q} onChangeText={setQ} />;
  const typeFilter = <Segmented options={{ all: { label: 'Todos' }, expense: { label: 'Gastos' }, income: { label: 'Ingresos' } }} value={fType} onChange={setFType} style={wide ? s.filterSeg : { marginTop: 0 }} />;
  const rangeFilter = <Segmented options={{ all: { label: 'Todo' }, month: { label: 'Este mes' }, '30d': { label: '30 días' } }} value={fRange} onChange={setFRange} style={wide ? s.filterSeg : null} />;
  const chips = (
    <View style={[s.chipsRow, !wide && { marginTop: 8 }]}>
      {Object.entries(BUCKETS).map(([k, x]) => (
        <Pressable key={k} onPress={() => setFBucket(fBucket === k ? null : k)} style={[s.chip, { backgroundColor: fBucket === k ? x.color : idle }]}>
          <Text style={[s.chipText, fBucket === k && { color: '#fff' }]}>{x.label}</Text>
        </Pressable>
      ))}
      <Pressable onPress={() => setFRec(!fRec)} style={[s.chip, { backgroundColor: fRec ? '#2D8A4E' : idle }]}>
        <Text style={[s.chipText, fRec && { color: '#fff' }]}>🔁 Recurrentes</Text>
      </Pressable>
    </View>
  );

  // Una fila: tocar abre la edición; deslizar a la izquierda borra
  const row = (m, i) => {
    const isInc = m.kind === 'income', c = CATS.find((x) => x.name === m.cat), b = BUCKETS[bucketOf(m.cat)];
    const ended = isRecurring(m) && !isActive(m, now);
    return (
      <SwipeRow key={m.id} first={i === 0} onDelete={() => onDelete(m.id)}>
        <Pressable style={[s.row, ended && { opacity: 0.5 }]} onPress={() => onEdit(m)}>
          <Text style={{ fontSize: 24, marginRight: 12 }}>{isInc ? '💵' : c ? c.icon : '🧾'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.body}>{moveTitle(m)}</Text>
            <Text style={[s.caption, { color: isInc ? '#4ADE80' : b.color }]}>{isInc ? 'Ingreso' : (!titleIsCat(m) ? m.cat + ' · ' : '') + b.label} · {freqLabel(asExp(m))}</Text>
          </View>
          <Text style={[s.body, { color: isInc ? '#4ADE80' : '#F87171' }]}>{isInc ? '+' : '-'}{money(m.amount, true)}</Text>
        </Pressable>
      </SwipeRow>
    );
  };

  return (
    <>
      <Text style={s.largeTitle}>Movimientos</Text>
      {wide ? (
        // Escritorio: búsqueda y filtros en una sola fila
        <View style={s.filterRow}>{search}{typeFilter}{rangeFilter}{chips}</View>
      ) : (
        // Móvil: búsqueda visible y filtros dentro de un desplegable
        <>
          <View style={s.searchRow}>
            {search}
            <Pressable style={s.filterBtn} onPress={() => setOpen(!open)}>
              <Text style={s.link}>Filtros{filterCount ? ' (' + filterCount + ')' : ''} {open ? '▴' : '▾'}</Text>
            </Pressable>
          </View>
          {open && <Card style={{ padding: 12 }}>{typeFilter}{rangeFilter}{chips}</Card>}
        </>
      )}

      {moves.length > 0 && (
        <Card style={{ marginTop: 8 }}>
          <MonthCalendar month={calMonth} onMonth={pickMonth} days={days} selected={selDay} onSelect={setSelDay} />
        </Card>
      )}
      {!!selDate && (
        <View style={[s.row, { paddingHorizontal: 4 }]}>
          <Text style={[s.body, { flex: 1, fontWeight: '600' }]}>{dayLabel(selDate, now).replace(/^./, (c) => c.toUpperCase())}</Text>
          <Pressable onPress={() => setSelDay(null)} hitSlop={8}><Text style={s.link}>Ver todos</Text></Pressable>
        </View>
      )}

      {loading && moves.length === 0 && <ActivityIndicator style={{ marginTop: 40 }} />}
      {!loading && moves.length === 0 && <Card><Text style={[s.hint, { padding: 16 }]}>Aún no hay movimientos. Toca + para agregar el primero.</Text></Card>}
      {!loading && moves.length > 0 && shown.length === 0 && <Card><Text style={[s.hint, { padding: 16 }]}>Ningún movimiento coincide con los filtros.</Text></Card>}
      {!!selDay && shown.length > 0 && !fixed.length && !oneOff.length && <Card><Text style={[s.hint, { padding: 16 }]}>No hay movimientos este día.</Text></Card>}

      {(oneOff.length > 0 || !!dayTotals) && (
        <Card style={{ marginTop: 8 }}>
          <View style={s.row}>
            <View style={{ flex: 1 }}><Text style={s.caption}>Ingresos</Text><Text style={[s.body, { color: '#4ADE80', paddingHorizontal: 16 }]}>+{money(inc)}</Text></View>
            <View style={{ flex: 1 }}><Text style={s.caption}>Gastos</Text><Text style={[s.body, { color: '#F87171', paddingHorizontal: 16 }]}>-{money(exp)}</Text></View>
          </View>
          <Text style={[s.caption, { marginTop: 0, marginBottom: 12 }]}>
            {selDay ? oneOff.length + fixed.length + (oneOff.length + fixed.length === 1 ? ' movimiento este día' : ' movimientos este día') : oneOff.length + ' movimientos' + (oneOff.length !== shown.length ? ' (sin contar pagos recurrentes)' : '')}
          </Text>
        </Card>
      )}

      {fixed.length > 0 && (
        <>
          <Title>{selDay ? 'Pagos fijos de este día' : 'Pagos fijos e ingresos recurrentes' + (fixedMonthly > 0 ? ' · ≈ ' + money(fixedMonthly) + ' al mes en pagos' : '')}</Title>
          <Card>{fixed.map(row)}</Card>
        </>
      )}

      {groups.map((g) => (
        <React.Fragment key={g.label + g.items[0].id}>
          <Title>{selDay ? 'Movimientos' : g.label}</Title>
          <Card>{g.items.map(row)}</Card>
        </React.Fragment>
      ))}

      {active ? <Pressable onPress={clear}><Text style={[s.link, { textAlign: 'center', marginTop: 12 }]}>Quitar filtros</Text></Pressable>
        : moves.length > 0 && <Text style={s.hint}>Toca un movimiento para editarlo o desliza a la izquierda para borrarlo.</Text>}
    </>
  );
}
