import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { SwipeRow } from '../components/SwipeRow';
import { Card, Segmented, Title } from '../components/ui';
import { BUCKETS, CATS } from '../constants/budget';
import { useWide } from '../hooks/useWide';
import { periodStart } from '../lib/dates';
import { asExp, bucketOf, freqLabel, isActive, isRecurring, moveTitle, titleIsCat } from '../lib/finance';
import { money } from '../lib/format';
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
  const fixed = shown.filter(isRecurring);
  const oneOff = shown.filter((m) => !isRecurring(m));
  const fixedMonthly = fixed.filter((m) => m.kind === 'expense' && isActive(m, now)).reduce((a, m) => a + m.amount * FACTOR[m.freq], 0);
  const inc = oneOff.filter((m) => m.kind === 'income').reduce((a, m) => a + m.amount, 0);
  const exp = oneOff.filter((m) => m.kind === 'expense').reduce((a, m) => a + m.amount, 0);

  // Movimientos de un solo día agrupados por fecha (ya vienen ordenados de más nuevo a más viejo)
  const groups = [];
  oneOff.forEach((m) => {
    const label = dayLabel(new Date(m.occurred_at), now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(m); else groups.push({ label, items: [m] });
  });

  const filterCount = (fType !== 'all' ? 1 : 0) + (fRange !== 'all' ? 1 : 0) + (fBucket ? 1 : 0) + (fRec ? 1 : 0);
  const active = q || fType !== 'all' || fRange !== 'all' || fBucket || fRec;
  const clear = () => { setQ(''); setFType('all'); setFRange('all'); setFBucket(null); setFRec(false); };
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

      {loading && moves.length === 0 && <ActivityIndicator style={{ marginTop: 40 }} />}
      {!loading && moves.length === 0 && <Card><Text style={[s.hint, { padding: 16 }]}>Aún no hay movimientos. Toca + para agregar el primero.</Text></Card>}
      {!loading && moves.length > 0 && shown.length === 0 && <Card><Text style={[s.hint, { padding: 16 }]}>Ningún movimiento coincide con los filtros.</Text></Card>}

      {oneOff.length > 0 && (
        <Card style={{ marginTop: 8 }}>
          <View style={s.row}>
            <View style={{ flex: 1 }}><Text style={s.caption}>{oneOff.length} movimientos</Text><Text style={[s.body, { color: '#4ADE80', paddingHorizontal: 16 }]}>+{money(inc)}</Text></View>
            <View style={{ flex: 1 }}><Text style={s.caption}>Total gastado</Text><Text style={[s.body, { color: '#F87171', paddingHorizontal: 16 }]}>-{money(exp)}</Text></View>
          </View>
        </Card>
      )}

      {fixed.length > 0 && (
        <>
          <Title>Pagos fijos e ingresos recurrentes{fixedMonthly > 0 ? ' · ≈ ' + money(fixedMonthly) + ' al mes en pagos' : ''}</Title>
          <Card>{fixed.map(row)}</Card>
        </>
      )}

      {groups.map((g) => (
        <React.Fragment key={g.label + g.items[0].id}>
          <Title>{g.label}</Title>
          <Card>{g.items.map(row)}</Card>
        </React.Fragment>
      ))}

      {active ? <Pressable onPress={clear}><Text style={[s.link, { textAlign: 'center', marginTop: 12 }]}>Quitar filtros</Text></Pressable>
        : moves.length > 0 && <Text style={s.hint}>Toca un movimiento para editarlo o desliza a la izquierda para borrarlo.</Text>}
    </>
  );
}
