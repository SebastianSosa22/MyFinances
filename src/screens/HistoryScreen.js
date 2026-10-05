import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { BudgetDonut } from '../components/BudgetDonut';
import { Delta } from '../components/Delta';
import { Bar, Card, Title } from '../components/ui';
import { BUCKETS, CATS } from '../constants/budget';
import { useWide } from '../hooks/useWide';
import { daysIn } from '../lib/dates';
import { bucketOf, report } from '../lib/finance';
import { money, monthName } from '../lib/format';
import { s } from '../theme/styles';

export function HistoryScreen({ moves }) {
  const [back, setBack] = useState(0);
  const wide = useWide();
  const now = new Date();
  const oldest = new Date(moves.reduce((a, m) => Math.min(a, new Date(m.occurred_at).getTime()), now.getTime()));
  const maxBack = (now.getFullYear() - oldest.getFullYear()) * 12 + now.getMonth() - oldest.getMonth();
  const b = Math.min(back, maxBack);
  const from = new Date(now.getFullYear(), now.getMonth() - b, 1);
  const to = b === 0 ? now : new Date(from.getFullYear(), from.getMonth() + 1, 0, 23, 59, 59, 999);
  const r = report(moves, from, to);
  const p = report(moves, new Date(from.getFullYear(), from.getMonth() - 1, 1), new Date(from.getFullYear(), from.getMonth(), 0, 23, 59, 59, 999));
  const balance = r.income - r.total;
  const cats = Object.entries(r.byCat).sort((x, y) => y[1] - x[1]);
  const rows = [...r.rows].sort((x, y) => new Date(y.m.occurred_at) - new Date(x.m.occurred_at));
  const days = b === 0 ? now.getDate() : daysIn(from.getFullYear(), from.getMonth());
  const spentPct = r.income > 0 ? Math.round((r.total / r.income) * 100) : 0;
  const savePct = r.income > 0 ? Math.round((r.spent.savings / r.income) * 100) : 0;
  const biggest = rows.filter((x) => x.amount < 0).sort((x, y) => x.amount - y.amount)[0];
  const Line = ({ label, value, color }) => (
    <View style={[s.row, s.sep, { paddingHorizontal: 0, justifyContent: 'space-between' }]}><Text style={s.body}>{label}</Text><Text style={[s.body, color && { color }]}>{value}</Text></View>
  );
  return (
    <>
      <Text style={s.largeTitle}>Historial</Text>
      <View style={[s.row, { justifyContent: 'space-between', paddingHorizontal: 4 }]}>
        <Pressable disabled={b >= maxBack} onPress={() => setBack(b + 1)} hitSlop={12}><Text style={[s.stepText, { fontSize: 28, opacity: b >= maxBack ? 0.25 : 1 }]}>‹</Text></Pressable>
        <Text style={[s.body, { fontWeight: '600' }]}>{monthName(from)}{b === 0 ? ' (en curso)' : ''}</Text>
        <Pressable disabled={b === 0} onPress={() => setBack(b - 1)} hitSlop={12}><Text style={[s.stepText, { fontSize: 28, opacity: b === 0 ? 0.25 : 1 }]}>›</Text></Pressable>
      </View>
      {r.rows.length === 0 ? <Text style={s.hint}>Sin movimientos en este mes.</Text> : (
        <>
          <View style={wide ? s.cols : null}>
          <View style={wide ? s.col : null}>
          <Card>
            <Text style={[s.caption, { marginTop: 12 }]}>Balance del mes</Text>
            <Text style={[s.big, balance < 0 && { color: '#FF3B30' }]}>{money(balance)}</Text>
            <View style={[s.row, s.sep, { marginTop: 12 }]}>
              <View style={{ flex: 1 }}><Text style={s.caption}>Ingresos</Text><Text style={[s.body, { color: '#34C759', paddingHorizontal: 16 }]}>{money(r.income)}</Text></View>
              <View style={{ flex: 1 }}><Text style={s.caption}>Gastos</Text><Text style={[s.body, { color: '#FF3B30', paddingHorizontal: 16 }]}>{money(r.total)}</Text></View>
            </View>
          </Card>
          <Card>
            <BudgetDonut spent={r.spent} income={r.income} center={<><Text style={s.big2}>{spentPct}%</Text><Text style={s.caption}>de tus ingresos</Text></>} />
            {Object.entries(BUCKETS).map(([k, x]) => {
              const target = (r.income * x.pct) / 100;
              return (
                <View key={k} style={[s.row, s.sep, { marginTop: 8, justifyContent: 'space-between' }]}>
                  <Text style={s.body}><Text style={{ color: x.color }}>● </Text>{x.label} {x.pct}%</Text>
                  <Text style={[s.body, r.spent[k] > target && { color: '#FF3B30' }]}>{money(r.spent[k])} / {money(target)}</Text>
                </View>
              );
            })}
          </Card>
          <Title>Datos del mes</Title>
          <Card style={{ paddingHorizontal: 16 }}>
            <View style={[s.row, { paddingHorizontal: 0, justifyContent: 'space-between' }]}><Text style={s.body}>Gasto promedio por día</Text><Text style={s.body}>{money(r.total / days)}</Text></View>
            <Line label="Tasa de ahorro (meta 20%)" value={savePct + '%'} color={savePct >= 20 ? '#34C759' : '#FF9500'} />
            {biggest && <Line label={'Mayor gasto · ' + (biggest.m.note || biggest.m.cat)} value={money(-biggest.amount, true)} />}
            <Line label="Movimientos" value={String(rows.length)} />
          </Card>
          </View>
          <View style={wide ? s.col : null}>
          {cats.length > 0 && (
            <>
              <Title>Gasto por categoría</Title>
              <Card>
                {cats.map(([name, amt], i) => {
                  const c = CATS.find((z) => z.name === name);
                  return (
                    <View key={name} style={[s.row, i > 0 && s.sep, { flexDirection: 'column', alignItems: 'stretch' }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={s.body}>{c ? c.icon : '🧾'} {name}</Text>
                        <Text style={s.body}>{money(amt)} · {Math.round((amt / r.total) * 100)}%</Text>
                      </View>
                      <Bar spent={amt} budget={cats[0][1]} color={BUCKETS[bucketOf(name)].color} />
                    </View>
                  );
                })}
              </Card>
            </>
          )}
          {(p.total > 0 || p.income > 0) && (
            <>
              <Title>Vs. el mes anterior</Title>
              <Card>
                <View style={s.row}>
                  <View style={{ flex: 1 }}><Text style={s.caption}>Ingresos</Text><Text style={[s.body, { paddingHorizontal: 16 }]}>{money(r.income)}</Text><Text style={s.caption}>antes {money(p.income)}</Text><Delta now={r.income} prev={p.income} upIsGood /></View>
                  <View style={{ flex: 1 }}><Text style={s.caption}>Gastos</Text><Text style={[s.body, { paddingHorizontal: 16 }]}>{money(r.total)}</Text><Text style={s.caption}>antes {money(p.total)}</Text><Delta now={r.total} prev={p.total} upIsGood={false} /></View>
                </View>
              </Card>
            </>
          )}
          <Title>Movimientos del mes</Title>
          <Card>
            {rows.map((x, i) => (
              <View key={x.m.id} style={[s.row, i > 0 && s.sep]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.body}>{x.m.kind === 'income' ? x.m.note || 'Ingreso' : x.m.note || x.m.cat}</Text>
                  <Text style={s.caption}>{x.m.kind === 'expense' && x.m.note ? x.m.cat + ' · ' : ''}{x.label}</Text>
                </View>
                <Text style={[s.body, { color: x.amount > 0 ? '#34C759' : '#FF3B30' }]}>{x.amount > 0 ? '+' : '-'}{money(Math.abs(x.amount), true)}</Text>
              </View>
            ))}
          </Card>
          </View>
          </View>
        </>
      )}
    </>
  );
}
