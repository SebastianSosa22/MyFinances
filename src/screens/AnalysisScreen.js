import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Delta } from '../components/Delta';
import { Amount } from '../components/HomeCards';
import { Icon } from '../components/Icon';
import { MONTH, MonthNav } from '../components/MonthNav';
import { Segmented } from '../components/ui';
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

  // Barra del mes: en gastos, cuánto de tus ingresos ya se fue
  const ratio = isExp ? (cur.income > 0 ? Math.min(cur.spent / cur.income, 1) : 0) : 1;
  const barColor = isExp ? (ratio >= 0.9 ? C.red : ratio >= 0.7 ? C.orange : C.primary) : C.primary;

  return (
    <>
      <View style={s.screenHead}><Text style={s.screenTitle}>¿En qué gasto más?</Text></View>
      <Segmented options={VIEWS} value={view} onChange={(v) => { setView(v); setOpen(null); }} style={s.segCard} />

      <MonthNav month={month} onMonth={pickMonth} min={oldest} max={startOfMonth(now)} sub={isExp ? 'has gastado' : 'entraron'}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14 }}>
          <View style={{ flex: 1 }}><Amount value={total} size={40} fit /></View>
          <Text style={[s.monthSub, { marginBottom: 6 }]}>{count} {count === 1 ? 'movimiento' : 'movimientos'}</Text>
        </View>
        {(isExp ? prev.spent : prev.income) > 0 && <Delta now={total} prev={isExp ? prev.spent : prev.income} upIsGood={!isExp} />}
        {(total > 0 || isExp) && (
          <>
            <View style={s.progressBg}><View style={{ width: (ratio * 100) + '%', height: '100%', borderRadius: 5, backgroundColor: barColor }} /></View>
            {isExp && cur.income > 0 && <Text style={[s.balanceSub, { marginTop: 8 }]}>{Math.round((cur.spent / cur.income) * 100)}% de lo que entró este mes</Text>}
          </>
        )}
      </MonthNav>

      {cats.length > 0 ? (
        <>
          <Text style={s.sectionBig}>{isExp ? 'Tus gastos por categoría' : 'Tus ingresos por categoría'}</Text>
          <View style={s.card}>
            {cats.map((g, i) => {
              const c = CATS.find((z) => z.name === g.name);
              const color = isExp ? (BUCKETS[bucketOf(g.name)] || BUCKETS.wants).color : C.green;
              const on = open === g.name;
              return (
                <View key={g.name} style={i > 0 && s.sep}>
                  <Pressable style={[s.row, { paddingVertical: 14 }]} onPress={() => setOpen(on ? null : g.name)}>
                    <View style={[s.iconBox, { borderLeftWidth: 3, borderLeftColor: color }]}><Text style={{ fontSize: 22 }}>{isExp ? (c ? c.icon : '🧾') : '💼'}</Text></View>
                    <Text style={[s.body, { flex: 1 }]} numberOfLines={1}>{g.name}</Text>
                    <Text style={[s.balanceLabel, { width: 44, textAlign: 'right', marginRight: 10 }]}>{Math.round((g.total / total) * 100)}%</Text>
                    <Text style={[s.body, { fontWeight: '700', color: isExp ? C.text : C.green }]}>{isExp ? '' : '+'}{money(g.total, true)}</Text>
                    <View style={{ marginLeft: 8 }}><Icon name={on ? 'chevronUp' : 'chevronDown'} size={18} color={C.muted} /></View>
                  </Pressable>
                  {on && g.rows.map((x, j) => (
                    <View key={x.m.id + '-' + j} style={[s.row, s.sep, { paddingLeft: 70 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.body, { fontSize: 15 }]} numberOfLines={1}>{moveTitle(x.m)}</Text>
                        <Text style={[s.balanceSub, { marginTop: 2 }]}>{x.label}</Text>
                      </View>
                      <Text style={[s.body, { fontSize: 15 }]}>{money(Math.abs(x.amount), true)}</Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
          {isExp && cur.kept > 0 && <Text style={[s.balanceSub, { paddingHorizontal: 4 }]}>🐷 Además apartaste {money(cur.kept, true)} para ahorro o inversión (no cuenta como gasto).</Text>}
        </>
      ) : (
        <Empty month={month} isExp={isExp} prevCats={isExp ? prev.expCats : prev.incCats} prevTotal={isExp ? prev.spent : prev.income} />
      )}

      <View style={s.btnRow}>
        <Pressable style={s.btnPrimary} onPress={onAdd}><Text style={s.btnText}>Agregar movimiento</Text></Pressable>
        <Pressable style={[s.btnGhost, month <= oldest && { opacity: 0.35 }]} disabled={month <= oldest} onPress={() => pickMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
          <Icon name="chevronLeft" size={18} color={C.text} /><Text style={s.btnText}>Mes anterior</Text>
        </Pressable>
      </View>

      {isExp && <Details moves={moves} month={month} data={cur} isCurrent={isCurrent} now={now} onSeeDay={onSeeDay} onSeeMoves={onSeeMoves} />}
    </>
  );
}

// Mes sin movimientos: cómo se vio el mes anterior
function Empty({ month, isExp, prevCats, prevTotal }) {
  return (
    <>
      <View style={{ alignItems: 'center', marginTop: 28 }}>
        <Text style={{ fontSize: 44 }}>📊</Text>
        <Text style={[s.sectionBig, { textAlign: 'center' }]}>Aún no hay {isExp ? 'gastos' : 'ingresos'} en {MONTH(month)}</Text>
        {prevCats.length > 0 && <Text style={[s.balanceSub, { fontSize: 16, marginTop: 6 }]}>Así se vio el mes pasado:</Text>}
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

// "Más a detalle": gasto día por día y tarjetas de suscripciones, lo que viene, gastos hormiga y ahorro
function Details({ moves, month, data, isCurrent, now, onSeeDay, onSeeMoves }) {
  const y = month.getFullYear(), m = month.getMonth();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  const total = daysIn(y, m);
  const cells = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const vals = Object.values(data.byDay);
  const max = Math.max(0, ...vals);
  const topDay = Object.entries(data.byDay).sort((a, b) => b[1] - a[1])[0];
  const daysCounted = isCurrent ? now.getDate() : total;

  const subs = moves.filter((x) => x.kind === 'expense' && x.cat === 'Suscripciones' && isRecurring(x) && isActive(x, now));
  const subsMonthly = subs.reduce((a, x) => a + x.amount * ({ weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, yearly: 1 / 12 }[x.freq] || 1), 0);
  const coming = isCurrent ? pendingBills(moves, now, data.last) : 0;
  const ants = data.r.rows.filter((x) => x.amount < 0 && !isRecurring(x.m) && !KEPT.includes(x.m.cat) && -x.amount <= ANT);
  const antTotal = ants.reduce((a, x) => a - x.amount, 0);

  return (
    <>
      <Text style={s.sectionBig}>Más a detalle</Text>
      <Pressable style={[s.card, { padding: 16 }]} onPress={onSeeMoves}>
        <View style={s.balanceHead}><Text style={s.miniTitle}>Tus gastos día por día</Text><Icon name="chevron" size={20} color={C.muted} /></View>
        <View style={{ flexDirection: 'row', marginTop: 8, gap: 14 }}>
          <View style={{ flex: 1.4 }}>
            {Array.from({ length: cells.length / 7 }, (_, r) => (
              <View key={r} style={{ flexDirection: 'row' }}>
                {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
                  if (!d) return <View key={i} style={[s.heatCell, { backgroundColor: 'transparent' }]} />;
                  const v = data.byDay[d] || 0, future = isCurrent && d > now.getDate();
                  const alpha = v > 0 ? 0.25 + 0.75 * (v / max) : 0;
                  return (
                    <Pressable key={i} style={[s.heatCell, { backgroundColor: v > 0 ? 'rgba(74,222,128,' + alpha.toFixed(2) + ')' : future ? 'transparent' : C.raised, borderWidth: future ? 1 : 0, borderColor: C.border }]}
                      onPress={() => onSeeDay(isoLocal(new Date(y, m, d)))} />
                  );
                })}
              </View>
            ))}
            <View style={{ flexDirection: 'row' }}>{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <Text key={i} style={[s.calWeekday, { marginTop: 4 }]}>{d}</Text>)}</View>
          </View>
          <View style={{ flex: 1 }}>
            {vals.length === 0 ? <Text style={s.miniText}>Sin gastos este mes</Text> : (
              <>
                <Text style={s.miniText}>Promedio diario</Text>
                <Text style={s.miniAmount}>{money(data.spent / daysCounted, true)}</Text>
                <Text style={[s.miniText, { marginTop: 12 }]}>Día más alto</Text>
                <Text style={s.miniAmount}>{money(topDay[1], true)}</Text>
                <Text style={s.miniText}>{shortDate(new Date(y, m, Number(topDay[0])))}</Text>
              </>
            )}
          </View>
        </View>
      </Pressable>

      <View style={[s.btnRow, { marginTop: 12 }]}>
        <MiniCard title="Suscripciones" value={subs.length ? money(subsMonthly, true) : null}
          text={subs.length ? 'Al mes · ' + subs.length + (subs.length === 1 ? ' activa' : ' activas') : 'No hemos visto suscripciones'} />
        <MiniCard title="Vienen este mes" value={coming > 0 ? money(coming, true) : null}
          text={!isCurrent ? 'Este mes ya cerró' : coming > 0 ? 'Pagos fijos que faltan' : 'Nada más por pagar este mes'} />
      </View>
      <View style={[s.btnRow, { marginTop: 12 }]}>
        <MiniCard title="Gastos hormiga" value={ants.length ? money(antTotal, true) : null}
          text={ants.length ? ants.length + (ants.length === 1 ? ' compra' : ' compras') + ' de ' + money(ANT) + ' o menos' : 'Ninguna compra de ' + money(ANT) + ' o menos'} />
        <MiniCard title="Apartaste" value={data.kept > 0 ? money(data.kept, true) : null}
          text={data.kept > 0 ? 'Para ahorro o inversión' : 'Nada para ahorro este mes'} />
      </View>
    </>
  );
}

const MiniCard = ({ title, value, text }) => (
  <View style={s.miniCard}>
    <Text style={s.miniTitle}>{title}</Text>
    {!!value && <Text style={s.miniAmount}>{value}</Text>}
    <Text style={s.miniText}>{text}</Text>
  </View>
);
