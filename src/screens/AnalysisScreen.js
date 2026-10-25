import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Amount } from '../components/HomeCards';
import { MONTH } from '../components/MonthNav';
import { DeltaChip, MonthSwitch, Panel, ScreenHeader, Segmented, Tile } from '../components/ui';
import { BUCKETS, CATS } from '../constants/budget';
import { daysIn, endOfDay, startOfMonth } from '../lib/dates';
import { bucketOf, calendarDays, isActive, isRecurring, moveTitle, report } from '../lib/finance';
import { isoLocal, money, shortDate } from '../lib/format';
import { KEPT, keptOf, outflowOf, pendingBills } from '../lib/summary';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

const ANT = 150; // "gasto hormiga": compras de una sola vez de este monto o menos
const VIEWS = { expense: { label: 'Gastos' }, income: { label: 'Ingresos' } };

// Cifras de un mes: gasto (sin contar lo guardado), ingresos, filas por categoría y gasto por día
function monthData(moves, month, now) {
  const from = startOfMonth(month);
  const last = endOfDay(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const to = last < now ? last : now;
  const r = report(moves, from, to);
  const expRows = r.rows.filter((x) => x.amount < 0 && !KEPT.includes(x.m.cat));
  const incRows = r.rows.filter((x) => x.amount > 0);
  const group = (rows, keyOf) => {
    const map = {};
    rows.forEach((x) => { const k = keyOf(x.m); (map[k] || (map[k] = { name: k, total: 0, rows: [] })).total += Math.abs(x.amount); map[k].rows.push(x); });
    return Object.values(map).sort((a, b) => b.total - a.total);
  };
  // Gasto por día (los recurrentes cuentan el día en que ocurren)
  const byDay = {};
  Object.entries(calendarDays(moves.filter((m) => m.kind === 'expense' && !KEPT.includes(m.cat)), from)).forEach(([key, x]) => {
    const d = Number(key.slice(8, 10));
    if (x.exp > 0 && new Date(month.getFullYear(), month.getMonth(), d) <= to) byDay[d] = x.exp;
  });
  return {
    from, last, to, r,
    spent: outflowOf(r), kept: keptOf(r.byCat), income: r.income,
    expCats: group(expRows, (m) => m.cat || 'Sin categoría'),
    incCats: group(incRows, (m) => moveTitle(m)),
    expCount: expRows.length, incCount: incRows.length,
    byDay,
  };
}

export function AnalysisScreen({ moves, onAdd, onSeeDay, onSeeMoves }) {
  const now = new Date();
  const [view, setView] = useState('expense');
  const [month, setMonth] = useState(() => startOfMonth(now));
  const [open, setOpen] = useState(null); // categoría desplegada
  const first = useMemo(() => moves.reduce((a, m) => Math.min(a, new Date(m.occurred_at).getTime()), Infinity), [moves]);
  const oldest = startOfMonth(Number.isFinite(first) && first < now.getTime() ? new Date(first) : now);
  const cur = useMemo(() => monthData(moves, month, new Date()), [moves, month]);
  const prev = useMemo(() => monthData(moves, new Date(month.getFullYear(), month.getMonth() - 1, 1), new Date()), [moves, month]);
  const isExp = view === 'expense';
  const total = isExp ? cur.spent : cur.income;
  const count = isExp ? cur.expCount : cur.incCount;
  const cats = isExp ? cur.expCats : cur.incCats;
  const isCurrent = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
  const pickMonth = (d) => { setMonth(d); setOpen(null); };

  return (
    <>
      <ScreenHeader title="Análisis" right={<MonthSwitch month={month} onMonth={pickMonth} min={oldest} max={startOfMonth(now)} />} />
      <Segmented options={VIEWS} value={view} onChange={(v) => { setView(v); setOpen(null); }} style={{ marginTop: 10 }} />

      {cats.length > 0 && <Panel>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={s.smallMuted}>{isExp ? 'Tus gastos día por día' : 'Lo que entró en ' + MONTH(month).toLowerCase()}</Text>
            <Amount value={total} size={28} fit />
          </View>
          <DeltaChip now={total} prev={isExp ? prev.spent : prev.income} upIsGood={!isExp} label={'vs. ' + MONTH(new Date(month.getFullYear(), month.getMonth() - 1, 1)).slice(0, 3).toLowerCase()} />
        </View>
        {isExp ? <DayBars data={cur} month={month} isCurrent={isCurrent} now={now} onSeeDay={onSeeDay} /> : (
          <Text style={s.smallMuted}>{count} {count === 1 ? 'ingreso' : 'ingresos'} este mes</Text>
        )}
      </Panel>}

      {cats.length > 0 ? (
        <Panel title={isExp ? '¿En qué gasto más?' : '¿De dónde entra tu dinero?'}>
          {cats.map((g) => {
            const color = isExp ? (BUCKETS[bucketOf(g.name)] || BUCKETS.wants).color : C.green;
            const on = open === g.name;
            const w = cats[0].total > 0 ? (g.total / cats[0].total) * 100 : 0;
            return (
              <View key={g.name} style={{ gap: 6 }}>
                <Pressable accessibilityRole="button" onPress={() => setOpen(on ? null : g.name)} style={{ gap: 6 }} accessibilityLabel={'Ver movimientos de ' + g.name}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                    <Text style={[s.rowTitle, { fontSize: 14, flex: 1 }]} numberOfLines={1}>{g.name} <Text style={s.tileLabel}>{Math.round((g.total / total) * 100)}%</Text></Text>
                    <Text style={[s.rowAmount, { fontSize: 14, color: isExp ? C.text : C.green }]}>{isExp ? '' : '+'}{money(Math.round(g.total))}</Text>
                  </View>
                  <View style={s.barBg}><View style={{ width: w + '%', height: 6, borderRadius: 3, backgroundColor: color }} /></View>
                </Pressable>
                {on && g.rows.map((x, j) => (
                  <View key={x.m.id + '-' + j} style={[s.hintRow, { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[s.rowTitle, { fontSize: 14 }]} numberOfLines={1}>{moveTitle(x.m)}</Text>
                      <Text style={s.rowSub}>{x.label}</Text>
                    </View>
                    <Text style={[s.rowAmount, { fontSize: 13 }]}>{money(Math.abs(x.amount), true)}</Text>
                  </View>
                ))}
              </View>
            );
          })}
          {isExp && cur.kept > 0 && <Text style={s.smallMuted}>Además apartaste {money(cur.kept, true)} para ahorro o inversión (no cuenta como gasto).</Text>}
        </Panel>
      ) : (
        <Empty month={month} isExp={isExp} prevCats={isExp ? prev.expCats : prev.incCats} prevTotal={isExp ? prev.spent : prev.income} onAdd={onAdd} />
      )}

      {isExp && cats.length > 0 && <Details moves={moves} data={cur} isCurrent={isCurrent} now={now} onSeeMoves={onSeeMoves} />}
    </>
  );
}

// Barras de gasto por día del mes, promedio diario y el día más alto
function DayBars({ data, month, isCurrent, now, onSeeDay }) {
  const y = month.getFullYear(), m = month.getMonth();
  const total = daysIn(y, m);
  const shownDays = isCurrent ? now.getDate() : total;
  const vals = Object.values(data.byDay);
  const max = Math.max(0, ...vals);
  const topDay = Object.entries(data.byDay).sort((a, b) => b[1] - a[1])[0];
  const ticks = [1, 8, 15, 22, shownDays].filter((d, i, a) => d <= shownDays && a.indexOf(d) === i);
  return (
    <>
      <View style={s.dayBars}>
        {Array.from({ length: shownDays }, (_, i) => {
          const d = i + 1, v = data.byDay[d] || 0;
          const h = max > 0 ? Math.max((v / max) * 100, v > 0 ? 6 : 2) : 2;
          const color = d === shownDays && isCurrent ? C.primary : v === max && v > 0 ? C.orange : '#33405A';
          return <Pressable accessibilityRole="button" key={d} style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }} onPress={() => onSeeDay(isoLocal(new Date(y, m, d)))} accessibilityLabel={'Día ' + d}><View style={{ height: h + '%', borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: color }} /></Pressable>;
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {ticks.map((d) => <Text key={d} style={[s.rowAmount, { fontSize: 11, color: C.muted }]}>{d}</Text>)}
      </View>
      <View style={s.tileRow}>
        <Tile label="Promedio diario" value={money(Math.round(data.spent / Math.max(shownDays, 1)))} />
        <Tile label={'Día más alto' + (topDay ? ' · ' + shortDate(new Date(y, m, Number(topDay[0]))) : '')} value={topDay ? money(Math.round(topDay[1])) : '—'} />
      </View>
    </>
  );
}

// Mes sin movimientos: cómo se vio el mes anterior
function Empty({ month, isExp, prevCats, prevTotal, onAdd }) {
  return (
    <>
      <View style={{ alignItems: 'center', marginTop: 28 }}>
        <Text style={{ fontSize: 44 }}>📊</Text>
        <Text style={[s.sectionBig, { textAlign: 'center' }]}>Aún no hay {isExp ? 'gastos' : 'ingresos'} en {MONTH(month)}</Text>
        <Pressable accessibilityRole="button" style={[s.button, { alignSelf: 'stretch' }]} onPress={onAdd}><Text style={s.buttonText}>Agregar movimiento</Text></Pressable>
        {prevCats.length > 0 && <Text style={[s.balanceSub, { fontSize: 16, marginTop: 14 }]}>Así se vio el mes pasado:</Text>}
      </View>
      {prevCats.slice(0, 5).map((g, i) => {
        const c = CATS.find((z) => z.name === g.name);
        return (
          <View key={g.name} style={[s.card, s.row, { paddingVertical: 16, opacity: 0.75, marginTop: 10 }]}>
            <Text style={[s.balanceLabel, { width: 34 }]}>#{i + 1}</Text>
            {isExp && <Text style={{ fontSize: 22, marginRight: 10 }}>{c ? c.icon : '🧾'}</Text>}
            <Text style={[s.body, { flex: 1 }]} numberOfLines={1}>{g.name}</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[s.body, { fontWeight: '700' }]}>{money(g.total, true)}</Text>
              <Text style={s.balanceSub}>{Math.round((g.total / prevTotal) * 100)}%</Text>
            </View>
          </View>
        );
      })}
    </>
  );
}

// Tarjetas chicas: suscripciones, gastos hormiga, lo que viene y lo apartado
function Details({ moves, data, isCurrent, now, onSeeMoves }) {
  const subs = moves.filter((x) => x.kind === 'expense' && x.cat === 'Suscripciones' && isRecurring(x) && isActive(x, now));
  const subsMonthly = subs.reduce((a, x) => a + x.amount * ({ weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, yearly: 1 / 12 }[x.freq] || 1), 0);
  const coming = isCurrent ? pendingBills(moves, now, data.last) : 0;
  const ants = data.r.rows.filter((x) => x.amount < 0 && !isRecurring(x.m) && !KEPT.includes(x.m.cat) && -x.amount <= ANT);
  const antTotal = ants.reduce((a, x) => a - x.amount, 0);
  return (
    <>
      <View style={[s.tileRow, { gap: 12, marginTop: 14 }]}>
        <MiniCard title="Suscripciones" value={subs.length ? money(Math.round(subsMonthly)) : null} unit="/mes"
          text={subs.length ? subs.length + (subs.length === 1 ? ' activa' : ' activas') : 'No hemos visto suscripciones'} />
        <MiniCard title="Gastos hormiga" value={ants.length ? money(Math.round(antTotal)) : null} onPress={onSeeMoves}
          text={ants.length ? ants.length + (ants.length === 1 ? ' compra' : ' compras') + ' de ' + money(ANT) + ' o menos' : 'Ninguna compra de ' + money(ANT) + ' o menos'} />
      </View>
      <View style={[s.tileRow, { gap: 12, marginTop: 12 }]}>
        <MiniCard title="Vienen este mes" value={coming > 0 ? money(Math.round(coming)) : null}
          text={!isCurrent ? 'Este mes ya cerró' : coming > 0 ? 'Pagos fijos que faltan' : 'Nada más por pagar'} />
        <MiniCard title="Apartaste" value={data.kept > 0 ? money(Math.round(data.kept)) : null}
          text={data.kept > 0 ? 'Para ahorro o inversión' : 'Nada para ahorro este mes'} />
      </View>
    </>
  );
}

const MiniCard = ({ title, value, unit, text, onPress }) => {
  const body = (
    <>
      <Text style={s.tileLabel}>{title}</Text>
      {!!value && <Text style={[s.statCardValue, { fontSize: 18 }]} numberOfLines={1}>{value}{!!unit && <Text style={[s.tileLabel, { fontSize: 12 }]}>{unit}</Text>}</Text>}
      <Text style={s.tileLabel} numberOfLines={2}>{text}</Text>
    </>
  );
  return onPress ? <Pressable accessibilityRole="button" style={s.statCard} onPress={onPress}>{body}</Pressable> : <View style={s.statCard}>{body}</View>;
};
