import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { BudgetDonut } from '../components/BudgetDonut';
import { SavingsCard } from '../components/SavingsCard';
import { Delta } from '../components/Delta';
import { Bar, Card, Segmented, Title } from '../components/ui';
import { BUCKETS, CATS, PERIODS } from '../constants/budget';
import { useWide } from '../hooks/useWide';
import { asExp, bucketOf, freqLabel, moveTitle } from '../lib/finance';
import { money, shortDate } from '../lib/format';
import { buildInsights } from '../lib/insights';
import { savingsBox } from '../lib/savings';
import { homeSummary } from '../lib/summary';
import { s } from '../theme/styles';

export function HomeScreen({ moves, limits, settings, loading, onSeeAll }) {
  const wide = useWide();
  const [pick, setPick] = useState(null);
  const period = pick || settings.cycle; // el Resumen abre en TU ciclo de cobro
  const dayKey = new Date().toDateString();
  const sm = useMemo(() => homeSummary(moves, limits, period, new Date(), settings.payDay), [moves, limits, period, settings.payDay, settings.split, dayKey]);
  const box = useMemo(() => savingsBox(moves, settings), [moves, settings, dayKey]);
  const insights = useMemo(() => buildInsights(moves, settings), [moves, settings, dayKey]);
  const { now, start, end, cur, income, spent, totalSpent, limitRows, prev, totalDays, elapsed, timePct, spentPct, flexSpent, flexBudget, flexPct, pending, flexLeft, perDay, projectedLeft, upcoming, topCats, overs, fixedShare, fixedPaid, cashBelowShare } = sm;

  if (loading) {
    return (<><Text style={s.largeTitle}>Resumen</Text><ActivityIndicator style={{ marginTop: 40 }} /></>);
  }

  const viewSpent = spent.needs + spent.wants + spent.savings;
  const paceColor = flexLeft < 0 || overs.length > 0 ? '#F87171' : flexPct > timePct || cashBelowShare ? '#FBBF24' : '#4ADE80';
  const overText = overs.map((o) => money(o.over) + ' en ' + BUCKETS[o.k].label).join(' y ');
  // Mensaje del ritmo: primero lo más importante (te pasaste en un bucket), luego el total y al final el ritmo
  const paceText = overs.length > 0
    ? 'Te pasaste ' + overText + '.' + (flexLeft > 0 ? ' Aún te quedan ' + money(flexLeft) + ' en total, pero conviene frenar ahí.' : '')
    : flexLeft < 0 ? 'Con tus pagos fijos que faltan ya rebasarías tu presupuesto del periodo.'
    : cashBelowShare ? 'Tu gasto va bien, pero en este periodo pagaste tu renta completa: te quedan ' + money(Math.max(flexLeft, 0)) + ' hasta el ' + shortDate(end) + '.'
    : flexPct > timePct ? 'Vas gastando más rápido de lo que avanza el periodo.'
    : 'Vas bien: tu gasto va por debajo del ritmo del periodo.';

  return (
    <>
      <Text style={s.largeTitle}>Resumen</Text>
      <Segmented options={PERIODS} value={period} onChange={setPick} />
      <View style={s.dateRow}>
        <Text style={s.dateText}>{shortDate(start)} – {shortDate(end)}</Text>
        <Text style={s.dateText}>Hoy, {shortDate(now)}</Text>
      </View>
      <View style={wide ? s.cols : null}>
        <View style={wide ? s.col : null}>
          <Card style={{ marginTop: 12, backgroundColor: '#22563A' }}>
            <Text style={[s.caption, { marginTop: 12 }]}>Puedes gastar hoy</Text>
            {income > 0 ? (
              <>
                <Text style={[s.big, flexLeft < 0 && { color: '#F87171' }]}>{money(perDay)}</Text>
                <Text style={s.caption}>
                  {flexLeft < 0 ? 'Tus pagos fijos que faltan ya rebasan tu presupuesto del periodo.' : 'Te quedan ' + money(flexLeft) + ' en Necesidades y Deseos hasta el ' + shortDate(end) + '.'}
                </Text>
                {fixedShare > 0 && (
                  <Text style={s.caption}>
                    {cashBelowShare
                      ? '🏠 Ya pagaste tu renta (' + money(fixedPaid) + ') en este periodo.'
                      : '🏠 Apartamos ' + money(fixedShare) + ' para tu renta.'}
                  </Text>
                )}
                {elapsed >= 2 && elapsed < totalDays && overs.length === 0 && Math.abs(projectedLeft - flexLeft) >= 1 && (
                  <Text style={[s.caption, { color: projectedLeft >= 0 ? '#4ADE80' : '#FBBF24' }]}>
                    {projectedLeft >= 0 ? 'A este ritmo cerrarás el periodo con ' + money(projectedLeft) + ' de margen.' : 'A este ritmo te pasarías ' + money(-projectedLeft) + ' de tu presupuesto.'}
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text style={[s.big, { color: '#8E8E93' }]}>—</Text>
                <Text style={s.caption}>Registra tu ingreso (o configura tu nómina) para calcularlo.</Text>
              </>
            )}
            <View style={[s.row, s.sep, { marginTop: 12 }]}>
              <View style={{ flex: 1 }}><Text style={s.caption}>Ingresos</Text><Text style={[s.body, { color: '#4ADE80', paddingHorizontal: 16 }]}>{money(income)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.caption}>Gastos</Text>
                <Text style={[s.body, { color: '#F87171', paddingHorizontal: 16 }]}>{money(totalSpent)}</Text>
                {fixedShare > 0 && Math.abs(viewSpent - totalSpent) >= 1 && <Text style={[s.caption, { marginTop: 2 }]}>{money(Math.round(viewSpent))} con renta repartida</Text>}
              </View>
            </View>
          </Card>

          {insights.length > 0 && (
            <>
              <Title>Para ti</Title>
              <Card>
                {insights.map((it, i) => (
                  <View key={i} style={[s.row, i > 0 && s.sep, { alignItems: 'flex-start' }]}>
                    <Text style={{ fontSize: 20, marginRight: 12 }}>{it.icon}</Text>
                    <Text style={[s.body, { flex: 1, fontSize: 15 }]}>{it.text}</Text>
                  </View>
                ))}
              </Card>
            </>
          )}

          {upcoming.length > 0 && (
            <>
              <Title>Próximos 7 días</Title>
              <Card>
                {upcoming.map((u, i) => {
                  const c = CATS.find((z) => z.name === u.m.cat);
                  return (
                    <View key={u.m.id + i} style={[s.row, i > 0 && s.sep]}>
                      <Text style={{ fontSize: 22, marginRight: 12 }}>{c ? c.icon : '🧾'}</Text>
                      <View style={{ flex: 1 }}><Text style={s.body}>{u.m.note || u.m.cat}</Text><Text style={s.caption}>{u.d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}</Text></View>
                      <Text style={[s.body, { color: '#F87171' }]}>-{money(u.m.amount, true)}</Text>
                    </View>
                  );
                })}
                <View style={[s.row, s.sep, { justifyContent: 'space-between' }]}><Text style={s.body}>Total por pagar</Text><Text style={[s.body, { fontWeight: '600' }]}>{money(upcoming.reduce((a, u) => a + u.m.amount, 0), true)}</Text></View>
              </Card>
            </>
          )}

          <Card>
            <BudgetDonut spent={spent} income={income} center={<><Text style={s.big2}>{spentPct}%</Text><Text style={s.caption}>de tus ingresos</Text></>} />
            {Object.entries(BUCKETS).map(([k, b]) => {
              const target = (income * b.pct) / 100;
              return (
                <View key={k} style={[s.row, s.sep, { marginTop: 8, justifyContent: 'space-between' }]}>
                  <Text style={[s.body, { flexShrink: 1, marginRight: 8 }]} numberOfLines={1}><Text style={{ color: b.color }}>● </Text>{b.label} {b.pct}%</Text>
                  <Text style={[s.body, spent[k] > target && { color: '#F87171' }]}>{money(Math.round(spent[k]))} / {money(Math.round(target))}</Text>
                </View>
              );
            })}
            {fixedShare > 0 && (
              <Text style={[s.caption, { marginTop: 8, marginBottom: 12 }]}>
                🏠 Tus gastos fijos (renta y pagos mensuales) se reparten entre los días que cubren: en este periodo cuentan {money(fixedShare)}.
              </Text>
            )}
          </Card>
          <SavingsCard info={box} cycle={settings.cycle} />
          {income === 0 && <Text style={s.hint}>Toca + y registra un ingreso para calcular tu presupuesto.</Text>}
        </View>
        <View style={wide ? s.col : null}>

          {income > 0 && (
            <>
              <Title>Ritmo del periodo</Title>
              <Card style={{ padding: 16 }}>
                <View style={s.paceHead}><Text style={s.body}>Día {elapsed} de {totalDays}</Text><Text style={s.caption}>{timePct}%</Text></View>
                <Bar spent={elapsed} budget={totalDays} color="#2D8A4E" />
                <View style={[s.paceHead, { marginTop: 14 }]}><Text style={s.body}>Gastado en Necesidades y Deseos</Text><Text style={s.caption}>{flexPct}%</Text></View>
                <Bar spent={flexSpent} budget={flexBudget} color={paceColor} />
                <Text style={[s.caption, { paddingHorizontal: 0 }]}>{money(flexSpent)} de {money(flexBudget)} ({BUCKETS.needs.pct + BUCKETS.wants.pct}% de tus ingresos)</Text>
                <Text style={[s.hint, { textAlign: 'left', marginTop: 12, color: paceColor }]}>
                  {paceText}
                </Text>
                {pending > 0 && <View style={[s.row, s.sep, s.paceRow]}><Text style={s.body}>Pagos fijos por venir</Text><Text style={s.body}>{money(pending)}</Text></View>}
                <View style={[s.row, s.sep, s.paceRow]}><Text style={s.body}>{fixedShare > 0 ? 'Gasto diario (sin fijos)' : 'Gasto promedio por día'}</Text><Text style={s.body}>{money((flexSpent - fixedShare) / elapsed)}</Text></View>
              </Card>
            </>
          )}

          {limitRows.length > 0 && (
            <>
              <Title>Límites del mes</Title>
              <Card>
                {limitRows.map(([cat, lim, sp], i) => {
                  const c = CATS.find((z) => z.name === cat), ratio = sp / lim;
                  const col = ratio >= 1 ? '#F87171' : ratio >= 0.8 ? '#FBBF24' : '#4ADE80';
                  return (
                    <View key={cat} style={[s.row, i > 0 && s.sep, { flexDirection: 'column', alignItems: 'stretch' }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={s.body}>{c ? c.icon : '🧾'} {cat}</Text>
                        <Text style={[s.body, ratio >= 0.8 && { color: col }]}>{money(sp)} / {money(lim)}</Text>
                      </View>
                      <Bar spent={sp} budget={lim} color={col} />
                    </View>
                  );
                })}
              </Card>
            </>
          )}

          {topCats.length > 0 && (
            <>
              <Title>En qué gastas más</Title>
              <Card>
                {topCats.map(([name, amt], i) => {
                  const c = CATS.find((z) => z.name === name);
                  return (
                    <View key={name} style={[s.row, i > 0 && s.sep, { flexDirection: 'column', alignItems: 'stretch' }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}><Text style={s.body}>{c ? c.icon : '🧾'} {name}</Text><Text style={s.body}>{money(amt)} · {Math.round((amt / cur.total) * 100)}%</Text></View>
                      <Bar spent={amt} budget={topCats[0][1]} color={BUCKETS[bucketOf(name)].color} />
                    </View>
                  );
                })}
              </Card>
            </>
          )}

          {prev && (prev.total > 0 || prev.income > 0) && (
            <>
              <Title>Vs. el mes pasado a esta fecha</Title>
              <Card>
                <View style={s.row}>
                  <View style={{ flex: 1 }}><Text style={s.caption}>Ingresos</Text><Text style={[s.body, { paddingHorizontal: 16 }]}>{money(income)}</Text><Text style={s.caption}>antes {money(prev.income)}</Text><Delta now={income} prev={prev.income} upIsGood /></View>
                  <View style={{ flex: 1 }}><Text style={s.caption}>Gastos</Text><Text style={[s.body, { paddingHorizontal: 16 }]}>{money(totalSpent)}</Text><Text style={s.caption}>antes {money(prev.total)}</Text><Delta now={totalSpent} prev={prev.total} upIsGood={false} /></View>
                </View>
              </Card>
            </>
          )}

          {moves.length > 0 && (
            <>
              <Title>Últimos movimientos</Title>
              <Card>
                {moves.slice(0, 4).map((m, i) => {
                  const isInc = m.kind === 'income', c = CATS.find((z) => z.name === m.cat);
                  return (
                    <View key={m.id} style={[s.row, i > 0 && s.sep]}>
                      <Text style={{ fontSize: 22, marginRight: 12 }}>{isInc ? '💵' : c ? c.icon : '🧾'}</Text>
                      <View style={{ flex: 1 }}><Text style={s.body}>{moveTitle(m)}</Text><Text style={s.caption}>{freqLabel(asExp(m))}</Text></View>
                      <Text style={[s.body, { color: isInc ? '#4ADE80' : '#F87171' }]}>{isInc ? '+' : '-'}{money(m.amount, true)}</Text>
                    </View>
                  );
                })}
                <Pressable style={[s.row, s.sep, { justifyContent: 'center' }]} onPress={() => onSeeAll()}><Text style={s.link}>Ver todos</Text></Pressable>
              </Card>
            </>
          )}
        </View>
      </View>
    </>
  );
}
