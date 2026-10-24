import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Amount } from '../components/HomeCards';
import { Icon } from '../components/Icon';
import { SwipeRow } from '../components/SwipeRow';
import { BUCKETS } from '../constants/budget';
import { endOfDay, startOfMonth } from '../lib/dates';
import { report } from '../lib/finance';
import { money, monthName, shortDate } from '../lib/format';
import { KEPT, keptOf, monthlyNeedsAverage } from '../lib/summary';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

const PURPLE = '#A78BFA';
const EMERGENCY_KEY = 'emergency_months';
const EMERGENCY_OPTS = [3, 6, 12];
const SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Meses que quieres cubrir con tu fondo de emergencia (se recuerda en el dispositivo)
function useEmergencyMonths() {
  const [months, setMonths] = useState(6);
  useEffect(() => { AsyncStorage.getItem(EMERGENCY_KEY).then((v) => { if (EMERGENCY_OPTS.includes(Number(v))) setMonths(Number(v)); }).catch(() => {}); }, []);
  const save = (n) => { setMonths(n); AsyncStorage.setItem(EMERGENCY_KEY, String(n)).catch(() => {}); };
  return [months, save];
}

// Ahorro: cuánto has guardado (Ahorro + Inversión), cómo va mes a mes, tus metas, tu fondo de emergencia y los movimientos de ahorro
export function SavingScreen({ moves, goals, onNewGoal, onEditGoal, onDeleteGoal, onContribute, onEditMove }) {
  const now = new Date();
  const [emMonths, setEmMonths] = useEmergencyMonths();
  const [emOpen, setEmOpen] = useState(false);
  const dayKey = now.toDateString();

  const data = useMemo(() => {
    const t = new Date();
    const savedMoves = moves.filter((m) => m.kind === 'expense' && KEPT.includes(m.cat));
    const first = moves.reduce((a, m) => Math.min(a, new Date(m.occurred_at).getTime()), t.getTime());
    const total = keptOf(report(savedMoves, new Date(first), t).byCat);
    const months = Array.from({ length: 6 }, (_, i) => {
      const from = new Date(t.getFullYear(), t.getMonth() - 5 + i, 1);
      const to = i === 5 ? t : endOfDay(new Date(from.getFullYear(), from.getMonth() + 1, 0));
      const r = report(savedMoves, from, to);
      return { label: SHORT[from.getMonth()], value: r.total, count: r.rows.length };
    });
    const thisMonth = report(moves, startOfMonth(t), t);
    return {
      total, months,
      count6: months.reduce((a, x) => a + x.count, 0),
      income: thisMonth.income, keptMonth: keptOf(thisMonth.byCat),
      needs: monthlyNeedsAverage(moves),
      list: savedMoves.filter((m) => new Date(m.occurred_at) <= t).sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at)).slice(0, 10),
    };
  }, [moves, dayKey]);

  const max = Math.max(0, ...data.months.map((x) => x.value));
  const target = (data.income * BUCKETS.savings.pct) / 100;
  const covered = data.needs > 0 ? data.total / data.needs : 0;
  const emPct = Math.min(Math.round((covered / emMonths) * 100), 100);

  return (
    <>
      <View style={[s.card, { padding: 18 }]}>
        <Text style={s.balanceLabel}>Tus ahorros</Text>
        <View style={{ marginTop: 4 }}><Amount value={data.total} size={40} /></View>
        <Text style={[s.balanceSub, { fontSize: 15 }]}>
          {data.count6} {data.count6 === 1 ? 'movimiento' : 'movimientos'} de ahorro en los últimos 6 meses
        </Text>
        <View style={s.barsRow}>
          {data.months.map((x, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ height: 90, justifyContent: 'flex-end' }}>
                <View style={[s.savingBar, { height: x.value > 0 ? Math.max(8, (x.value / max) * 90) : 3, backgroundColor: x.value > 0 ? PURPLE : C.raised }]} />
              </View>
              <Text style={[s.balanceSub, { marginTop: 8, fontSize: 15 }, i === 5 && { color: C.text, fontWeight: '700' }]}>{x.label}</Text>
            </View>
          ))}
        </View>
        {data.income > 0 && (
          <Text style={[s.balanceSub, { fontSize: 15, marginTop: 16, lineHeight: 21 }]}>
            Una referencia: con lo que entró este mes ({money(data.income, true)}), apartar el {BUCKETS.savings.pct}% serían{' '}
            <Text style={{ color: C.text, fontWeight: '700' }}>{money(target, true)}</Text>. Llevas {money(data.keptMonth, true)}.
          </Text>
        )}
      </View>

      <View style={[s.balanceHead, { marginTop: 20, marginBottom: 0, paddingHorizontal: 4 }]}>
        <Text style={[s.sectionBig, { marginTop: 0 }]}>Metas</Text>
        <Pressable onPress={onNewGoal} hitSlop={8}><Text style={[s.link, s.purple, { fontWeight: '600' }]}>+ Nueva meta</Text></Pressable>
      </View>
      {goals.length === 0 ? (
        <Pressable style={[s.card, s.dashed]} onPress={onNewGoal}>
          <Text style={{ fontSize: 34, marginRight: 14 }}>🎯</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.miniTitle}>¿Para qué estás ahorrando?</Text>
            <Text style={s.miniText}>Crea una meta y ve tu progreso cada que ahorras</Text>
          </View>
          <Text style={[s.plusText, s.purple, { fontSize: 30, marginLeft: 10 }]}>+</Text>
        </Pressable>
      ) : (
        <View style={s.card}>
          {goals.map((g, i) => <GoalRow key={g.id} goal={g} moves={moves} now={now} first={i === 0} onEdit={onEditGoal} onDelete={onDeleteGoal} onContribute={onContribute} />)}
        </View>
      )}

      <View style={[s.card, { padding: 18 }]}>
        <View style={s.balanceHead}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Text style={{ fontSize: 22 }}>🛡️</Text><Text style={s.miniTitle}>Fondo de emergencia</Text></View>
          <Pressable onPress={() => setEmOpen(!emOpen)} hitSlop={10} accessibilityLabel="Cambiar meta del fondo"><Text style={{ fontSize: 20 }}>⚙️</Text></Pressable>
        </View>
        {emOpen && (
          <View style={[s.chipsRow, { marginBottom: 6 }]}>
            {EMERGENCY_OPTS.map((n) => (
              <Pressable key={n} onPress={() => { setEmMonths(n); setEmOpen(false); }} style={[s.fChip, emMonths === n && { backgroundColor: PURPLE, borderColor: PURPLE }]}>
                <Text style={[s.fChipText, emMonths === n && { color: '#fff', fontWeight: '600' }]}>{n} meses</Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={{ flexDirection: 'row', marginTop: 10 }}>
          <View style={{ flex: 1 }}><Text style={s.balanceLabel}>Ahorrado</Text><Amount value={data.total} size={26} /></View>
          <View style={s.balanceDivider} />
          <View style={{ flex: 1, paddingLeft: 16 }}><Text style={s.balanceLabel}>Meta</Text><Text style={[s.amount, { fontSize: 26, color: C.text }]}>{emMonths} meses</Text></View>
        </View>
        <View style={[s.barBg, { height: 8, marginTop: 16 }]}><View style={{ width: emPct + '%', height: 8, borderRadius: 4, backgroundColor: PURPLE }} /></View>
        <View style={[s.balanceHead, { marginTop: 10, marginBottom: 0 }]}>
          <Text style={s.balanceLabel}>{data.needs > 0 ? covered.toFixed(1) + ' meses cubiertos' : 'Registra tus gastos para calcularlo'}</Text>
          <Text style={[s.body, s.purple, { fontWeight: '600' }]}>{emPct}%</Text>
        </View>
        {data.needs > 0 && <Text style={[s.balanceSub, { fontSize: 13 }]}>Un mes = lo que gastas en Necesidades, unos {money(Math.round(data.needs))}. Meta: {money(Math.round(data.needs * emMonths))}.</Text>}
      </View>

      <Text style={s.sectionBig}>Movimientos</Text>
      {data.list.length === 0 && <View style={[s.card, { padding: 16 }]}><Text style={[s.hint, { marginTop: 0 }]}>Aún no apartas nada. Registra un gasto en la categoría Ahorro o Inversión.</Text></View>}
      {data.list.length > 0 && (
        <View style={s.card}>
          {data.list.map((m, i) => (
            <Pressable key={m.id} style={[s.row, { paddingVertical: 14 }, i > 0 && s.sep]} onPress={() => onEditMove(m)}>
              <View style={{ flex: 1 }}>
                <Text style={[s.body, { fontWeight: '600' }]} numberOfLines={1}>{m.note || m.cat}</Text>
                <Text style={[s.balanceSub, { marginTop: 2 }]}>{shortDate(new Date(m.occurred_at))} {new Date(m.occurred_at).getFullYear()}{m.freq && m.freq !== 'once' ? ' · Recurrente' : ''}</Text>
              </View>
              <Amount value={m.amount} size={18} color={PURPLE} plus />
              <View style={{ marginLeft: 6 }}><Icon name="chevron" size={18} color={C.muted} /></View>
            </Pressable>
          ))}
        </View>
      )}
    </>
  );
}

function GoalRow({ goal: g, moves, now, first, onEdit, onDelete, onContribute }) {
  const mine = moves.filter((m) => m.goal_id === g.id);
  const saved = mine.reduce((a, m) => a + m.amount, 0);
  const rem = Math.max(g.target - saved, 0), done = saved >= g.target;
  const firstT = mine.reduce((a, m) => Math.min(a, new Date(m.occurred_at).getTime()), now.getTime());
  const pace = saved / Math.max((now.getTime() - firstT) / (30.4 * 864e5), 1);
  let hint = '';
  if (done) hint = '¡Meta lograda! 🎉';
  else if (g.deadline) {
    const dl = new Date(g.deadline + 'T12:00:00');
    hint = dl < now ? 'La fecha de esta meta ya pasó' : 'Para el ' + dl.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ahorra ' + money(rem / Math.max(Math.ceil((dl - now) / (30.4 * 864e5)), 1)) + ' al mes';
  } else if (pace > 0) hint = 'A tu ritmo la alcanzas en ' + monthName(new Date(now.getTime() + (rem / pace) * 30.4 * 864e5));
  const pct = Math.min(Math.round((saved / g.target) * 100), 100);
  return (
    <SwipeRow first={first} onDelete={() => onDelete(g.id)}>
      <Pressable style={{ padding: 16 }} onPress={() => onEdit(g)}>
        <View style={s.balanceHead}>
          <Text style={[s.body, { fontWeight: '600', flex: 1 }]} numberOfLines={1}>🎯 {g.name}</Text>
          <Text style={[s.body, s.purple, { fontWeight: '600' }]}>{pct}%</Text>
        </View>
        <View style={[s.barBg, { height: 8 }]}><View style={{ width: pct + '%', height: 8, borderRadius: 4, backgroundColor: PURPLE }} /></View>
        <Text style={[s.balanceSub, { marginTop: 8 }]}>{money(saved)} de {money(g.target)}{!done ? ' · faltan ' + money(rem) : ''}</Text>
        {!!hint && <Text style={[s.balanceSub, { marginTop: 2 }]}>{hint}</Text>}
        {!done && <Pressable onPress={() => onContribute(g)} style={{ alignSelf: 'flex-start', marginTop: 10 }} hitSlop={8}><Text style={[s.link, s.purple, { fontWeight: '600' }]}>+ Aportar</Text></Pressable>}
      </Pressable>
    </SwipeRow>
  );
}
