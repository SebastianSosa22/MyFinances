import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Amount } from '../components/HomeCards';
import { SwipeRow } from '../components/SwipeRow';
import { BUCKETS } from '../constants/budget';
import { endOfDay, startOfMonth } from '../lib/dates';
import { report } from '../lib/finance';
import { money, monthName, shortDate } from '../lib/format';
import { KEPT, keptOf, monthlyNeedsAverage } from '../lib/summary';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

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

  const fmt = (v) => money(Math.round(v));
  return (
    <>
      <View style={[s.panel, { padding: 20, gap: 16 }]}>
        <View style={{ gap: 4 }}>
          <Text style={s.eyebrow}>Tus ahorros</Text>
          <Amount value={data.total} size={36} color={C.primary} fit />
          <Text style={s.smallMuted}>{data.count6} {data.count6 === 1 ? 'movimiento' : 'movimientos'} de ahorro en los últimos 6 meses</Text>
        </View>
        {data.count6 > 0 ? <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 112 }}>
          {data.months.map((x, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
              {x.value > 0 && <Text style={[s.rowAmount, { fontSize: 11, color: i === 5 ? C.text : C.muted }]} numberOfLines={1}>{fmt(x.value)}</Text>}
              <View style={{ width: '100%', height: x.value > 0 ? Math.max(8, (x.value / max) * 64) : 3, borderRadius: 8, backgroundColor: i === 5 ? C.primary : '#1E3A30' }} />
              <Text style={[s.tileLabel, i === 5 && { color: C.text, fontWeight: '600' }]}>{x.label}</Text>
            </View>
          ))}
        </View> : <Text style={s.smallMuted}>Cuando registres un gasto en Ahorro o Inversión, aquí verás cuánto apartas cada mes.</Text>}
        {data.income > 0 && (
          <Text style={s.smallMuted}>
            Con lo que entró este mes ({fmt(data.income)}), apartar el {BUCKETS.savings.pct}% serían <Text style={[s.rowAmount, { fontSize: 13 }]}>{fmt(target)}</Text>. Llevas <Text style={[s.rowAmount, { fontSize: 13, color: C.primary }]}>{fmt(data.keptMonth)}</Text>.
          </Text>
        )}
      </View>

      <View style={[s.panelHead, { alignItems: 'center', marginTop: 20 }]}>
        <Text style={[s.sectionBig, { marginTop: 0 }]}>Metas</Text>
        <Pressable accessibilityRole="button" onPress={onNewGoal} style={s.smallBtn}><Text style={[s.linkSm, { fontWeight: '600' }]}>+ Nueva meta</Text></Pressable>
      </View>

      <View style={[s.panel, { borderRadius: 20, gap: 10 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[s.catBadge, { width: 42, height: 42, backgroundColor: C.greenSoft }]}><Text style={{ fontSize: 20 }}>🛡️</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.rowTitle, { fontWeight: '600' }]}>Fondo de emergencia</Text>
            <Pressable accessibilityRole="button" onPress={() => setEmOpen(!emOpen)} hitSlop={8} accessibilityLabel="Cambiar meta del fondo"><Text style={s.rowSub}>{emMonths} meses de gastos ▾</Text></Pressable>
          </View>
          <Text style={[s.rowAmount, { fontWeight: '600', color: C.primary }]}>{emPct}%</Text>
        </View>
        {emOpen && (
          <View style={s.wrapRow}>
            {EMERGENCY_OPTS.map((n) => (
              <Pressable accessibilityRole="button" key={n} onPress={() => { setEmMonths(n); setEmOpen(false); }} style={[s.catChip, emMonths === n && s.catChipOn]}>
                <Text style={[s.catChipText, emMonths === n && { fontWeight: '600' }]}>{n} meses</Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={s.barBg}><View style={{ width: emPct + '%', height: 6, borderRadius: 3, backgroundColor: C.primary }} /></View>
        <Text style={s.smallMuted}>
          {data.needs > 0
            ? <><Text style={[s.rowAmount, { fontSize: 13 }]}>{fmt(data.total)}<Text style={{ color: C.muted }}> / {fmt(data.needs * emMonths).slice(1)}</Text></Text> · {covered.toFixed(1)} meses cubiertos</>
            : 'Registra tus gastos para calcularlo'}
        </Text>
      </View>

      {goals.length === 0 ? (
        <Pressable accessibilityRole="button" style={[s.dashedCard, { marginTop: 12 }]} onPress={onNewGoal}>
          <Text style={s.panelTitle}>🎯 ¿Para qué estás ahorrando?</Text>
          <Text style={s.smallMuted}>Crea una meta y ve tu progreso cada que ahorras.</Text>
        </Pressable>
      ) : goals.map((g) => <GoalRow key={g.id} goal={g} moves={moves} now={now} onEdit={onEditGoal} onDelete={onDeleteGoal} onContribute={onContribute} />)}

      <Text style={s.sectionBig}>Movimientos</Text>
      {data.list.length === 0 && <Text style={[s.smallMuted, { marginTop: 6 }]}>Aún no apartas nada. Registra un gasto en la categoría Ahorro o Inversión.</Text>}
      {data.list.map((m) => (
        <Pressable accessibilityRole="button" key={m.id} style={s.listRow} onPress={() => onEditMove(m)}>
          <View style={[s.catBadge, { backgroundColor: C.greenSoft }]}><Text style={{ fontSize: 16 }}>🐷</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.rowTitle} numberOfLines={1}>{m.note || m.cat}</Text>
            <Text style={s.rowSub}>{shortDate(new Date(m.occurred_at))} {new Date(m.occurred_at).getFullYear()}{m.freq && m.freq !== 'once' ? ' · ↻ Recurrente' : ''}</Text>
          </View>
          <Text style={[s.rowAmount, { color: C.primary }]}>+{money(m.amount)}</Text>
        </Pressable>
      ))}
    </>
  );
}

function GoalRow({ goal: g, moves, now, onEdit, onDelete, onContribute }) {
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
    <SwipeRow card onDelete={() => onDelete(g.id)}>
    <Pressable accessibilityRole="button" style={[s.panel, { borderRadius: 20, gap: 10, marginTop: 0 }]} onPress={() => onEdit(g)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={[s.catBadge, { width: 42, height: 42, backgroundColor: '#1B2A44' }]}><Text style={{ fontSize: 20 }}>🎯</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.rowTitle, { fontWeight: '600' }]} numberOfLines={1}>{g.name}</Text>
          <Text style={s.rowSub} numberOfLines={1}>{g.deadline ? 'Para el ' + new Date(g.deadline + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }) : 'Sin fecha'}</Text>
        </View>
        <Text style={[s.rowAmount, { fontWeight: '600', color: C.primary }]}>{pct}%</Text>
      </View>
      <View style={s.barBg}><View style={{ width: pct + '%', height: 6, borderRadius: 3, backgroundColor: done ? C.primary : C.blue }} /></View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.rowAmount, { fontSize: 14 }]}>{money(saved)}<Text style={{ color: C.muted }}> / {money(g.target).slice(1)}</Text></Text>
          {!!hint && <Text style={s.rowSub} numberOfLines={2}>{hint}</Text>}
        </View>
        {!done && <Pressable accessibilityRole="button" onPress={() => onContribute(g)} style={s.smallBtn} hitSlop={6}><Text style={[s.linkSm, { fontWeight: '600' }]}>+ Aportar</Text></Pressable>}
      </View>
    </Pressable>
    </SwipeRow>
  );
}
