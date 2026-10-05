import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { SwipeRow } from '../components/SwipeRow';
import { Card, Segmented } from '../components/ui';
import { BUCKETS, CATS } from '../constants/budget';
import { useWide } from '../hooks/useWide';
import { periodStart } from '../lib/dates';
import { asExp, bucketOf, freqLabel } from '../lib/finance';
import { money } from '../lib/format';
import { s } from '../theme/styles';

export function MovesScreen({ moves, onDelete }) {
  const wide = useWide();
  const [q, setQ] = useState('');
  const [fType, setFType] = useState('all');
  const [fRange, setFRange] = useState('all');
  const [fBucket, setFBucket] = useState(null);
  const [fRec, setFRec] = useState(false);
  const now = new Date();

  const isRec = (m) => m.kind === 'expense' && m.freq && m.freq !== 'once';
  const ql = q.trim().toLowerCase();
  const shown = moves.filter((m) => {
    if (fType !== 'all' && m.kind !== fType) return false;
    if (fBucket && (m.kind === 'income' || bucketOf(m.cat) !== fBucket)) return false;
    if (fRec && !isRec(m)) return false;
    const d = new Date(m.occurred_at);
    if (!isRec(m) && fRange === 'month' && d < periodStart('monthly')) return false;
    if (!isRec(m) && fRange === '30d' && d < new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)) return false;
    if (ql && !((m.cat || '').toLowerCase().includes(ql) || (m.note || '').toLowerCase().includes(ql))) return false;
    return true;
  });
  const inc = shown.filter((m) => m.kind === 'income').reduce((a, m) => a + m.amount, 0);
  const exp = shown.filter((m) => m.kind === 'expense').reduce((a, m) => a + m.amount, 0);
  const active = q || fType !== 'all' || fRange !== 'all' || fBucket || fRec;
  const clear = () => { setQ(''); setFType('all'); setFRange('all'); setFBucket(null); setFRec(false); };
  return (
    <>
      <Text style={s.largeTitle}>Movimientos</Text>
      <View style={wide ? s.cols : null}>
      <View style={wide ? s.colSide : null}>
      <TextInput style={[s.input, { backgroundColor: '#E3E3E8', marginTop: 0 }]} placeholder="Buscar categoría o concepto" value={q} onChangeText={setQ} />
      <Segmented options={{ all: { label: 'Todos' }, expense: { label: 'Gastos' }, income: { label: 'Ingresos' } }} value={fType} onChange={setFType} />
      <Segmented options={{ all: { label: 'Todo' }, month: { label: 'Este mes' }, '30d': { label: '30 días' } }} value={fRange} onChange={setFRange} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
        {Object.entries(BUCKETS).map(([k, x]) => (
          <Pressable key={k} onPress={() => setFBucket(fBucket === k ? null : k)} style={[s.chip, { backgroundColor: fBucket === k ? x.color : '#fff' }]}>
            <Text style={[s.chipText, fBucket === k && { color: '#fff' }]}>{x.label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setFRec(!fRec)} style={[s.chip, { backgroundColor: fRec ? '#007AFF' : '#fff' }]}>
          <Text style={[s.chipText, fRec && { color: '#fff' }]}>🔁 Recurrentes</Text>
        </Pressable>
      </View>
      {shown.length > 0 && (
        <Card style={{ marginTop: 8 }}>
          <View style={s.row}>
            <View style={{ flex: 1 }}><Text style={s.caption}>{shown.length} movimientos</Text><Text style={[s.body, { color: '#34C759', paddingHorizontal: 16 }]}>+{money(inc)}</Text></View>
            <View style={{ flex: 1 }}><Text style={s.caption}>Total gastado</Text><Text style={[s.body, { color: '#FF3B30', paddingHorizontal: 16 }]}>-{money(exp)}</Text></View>
          </View>
        </Card>
      )}
      </View>
      <View style={wide ? s.col : null}>
      <Card style={wide ? { marginTop: 0 } : null}>
        {moves.length === 0 && <Text style={[s.hint, { padding: 16 }]}>Aún no hay movimientos. Toca + para agregar el primero.</Text>}
        {moves.length > 0 && shown.length === 0 && <Text style={[s.hint, { padding: 16 }]}>Ningún movimiento coincide con los filtros.</Text>}
        {shown.map((m, i) => {
          const isInc = m.kind === 'income', c = CATS.find((x) => x.name === m.cat), b = BUCKETS[bucketOf(m.cat)];
          return (
            <SwipeRow key={m.id} first={i === 0} onDelete={() => onDelete(m.id)}>
              <View style={s.row}>
                <Text style={{ fontSize: 24, marginRight: 12 }}>{isInc ? '💵' : c ? c.icon : '🧾'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.body}>{isInc ? m.note || 'Ingreso' : m.note || m.cat}</Text>
                  <Text style={[s.caption, { color: isInc ? '#34C759' : b.color }]}>{isInc ? 'Ingreso' : (m.note ? m.cat + ' · ' : '') + b.label} · {freqLabel(asExp(m))}</Text>
                </View>
                <Text style={[s.body, { color: isInc ? '#34C759' : '#FF3B30' }]}>{isInc ? '+' : '-'}{money(m.amount, true)}</Text>
              </View>
            </SwipeRow>
          );
        })}
      </Card>
      {active ? <Pressable onPress={clear}><Text style={[s.link, { textAlign: 'center', marginTop: 12 }]}>Quitar filtros</Text></Pressable>
        : moves.length > 0 && <Text style={s.hint}>Desliza un movimiento hacia la izquierda para borrarlo.</Text>}
      </View>
      </View>
    </>
  );
}
