import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { BudgetDonut } from '../components/BudgetDonut';
import { SavingsCard } from '../components/SavingsCard';
import { Delta } from '../components/Delta';
import { Bar, Card, Segmented, Title } from '../components/ui';
import { BUCKETS, CATS, PERIODS } from '../constants/budget';
import { useWide } from '../hooks/useWide';
import { asExp, bucketOf, freqLabel } from '../lib/finance';
import { money, shortDate } from '../lib/format';
import { savingsBox } from '../lib/savings';
import { homeSummary } from '../lib/summary';
import { s } from '../theme/styles';

export function HomeScreen({ moves, limits, settings, onSeeAll }) {
  const wide = useWide();
  const [period, setPeriod] = useState('monthly');
  const { now, start, end, cur, income, spent, totalSpent, limitRows, prev, totalDays, elapsed, timePct, spentPct, flexSpent, flexBudget, flexPct, pending, flexLeft, perDay, upcoming, topCats } = homeSummary(moves, limits, period);

  const box = savingsBox(moves, settings);

  return (
    <>
      <Text style={s.largeTitle}>Resumen</Text>
      <Segmented options={PERIODS} value={period} onChange={setPeriod} />
      <View style={s.dateRow}>
        <Text style={s.dateText}>{shortDate(start)} – {shortDate(end)}</Text>
        <Text style={s.dateText}>Hoy, {shortDate(now)}</Text>
      </View>
      <View style={wide ? s.cols : null}>
      <View style={wide ? s.col : null}>
      <Card style={{ marginTop: 12 }}>
        <Text style={[s.caption, { marginTop: 12 }]}>Disponible</Text>
        <Text style={[s.big, income - totalSpent < 0 && { color: '#FF3B30' }]}>{money(income - totalSpent)}</Text>
        <View style={[s.row, s.sep, { marginTop: 12 }]}>
          <View style={{ flex: 1 }}><Text style={s.caption}>Ingresos</Text><Text style={[s.body, { color: '#34C759', paddingHorizontal: 16 }]}>{money(income)}</Text></View>
          <View style={{ flex: 1 }}><Text style={s.caption}>Gastos</Text><Text style={[s.body, { color: '#FF3B30', paddingHorizontal: 16 }]}>{money(totalSpent)}</Text></View>
        </View>
      </Card>
      <Card>
        <BudgetDonut spent={spent} income={income} center={<><Text style={s.big2}>{spentPct}%</Text><Text style={s.caption}>de tus ingresos</Text></>} />
        {Object.entries(BUCKETS).map(([k, b]) => {
          const target = (income * b.pct) / 100;
          return (
            <View key={k} style={[s.row, s.sep, { marginTop: 8, justifyContent: 'space-between' }]}>
              <Text style={s.body}><Text style={{ color: b.color }}>● </Text>{b.label} {b.pct}%</Text>
              <Text style={[s.body, spent[k] > target && { color: '#FF3B30' }]}>{money(spent[k])} / {money(target)}</Text>
            </View>
          );
        })}
      </Card>
      <SavingsCard info={box} cycle={settings.cycle} />
      {income === 0 && <Text style={s.hint}>Toca + y registra un ingreso para calcular tu presupuesto.</Text>}

      {income > 0 && (
        <>
          <Title>Ritmo del periodo</Title>
          <Card style={{ padding: 16 }}>
            <View style={s.paceHead}><Text style={s.body}>Día {elapsed} de {totalDays}</Text><Text style={s.caption}>{timePct}%</Text></View>
            <Bar spent={elapsed} budget={totalDays} color="#007AFF" />
            <View style={[s.paceHead, { marginTop: 14 }]}><Text style={s.body}>Gastado en Necesidades y Deseos</Text><Text style={s.caption}>{flexPct}%</Text></View>
            <Bar spent={flexSpent} budget={flexBudget} color={flexLeft < 0 ? '#FF3B30' : flexPct > timePct ? '#FF9500' : '#34C759'} />
            <Text style={[s.caption, { paddingHorizontal: 0 }]}>{money(flexSpent)} de {money(flexBudget)} (80% de tus ingresos)</Text>
            <Text style={[s.hint, { textAlign: 'left', marginTop: 12, color: flexLeft < 0 ? '#FF3B30' : flexPct > timePct ? '#FF9500' : '#34C759' }]}>
              {flexLeft < 0 ? 'Con tus pagos fijos que faltan ya rebasarías tu presupuesto del periodo.' : flexPct > timePct ? 'Vas gastando más rápido de lo que avanza el periodo.' : 'Vas bien: tu gasto va por debajo del ritmo del periodo.'}
            </Text>
            <View style={[s.row, s.sep, s.paceRow]}><Text style={s.body}>Puedes gastar por día</Text><Text style={[s.body, { fontWeight: '600' }]}>{money(perDay)}</Text></View>
            {pending > 0 && <View style={[s.row, s.sep, s.paceRow]}><Text style={s.body}>Pagos fijos por venir</Text><Text style={s.body}>{money(pending)}</Text></View>}
            <View style={[s.row, s.sep, s.paceRow]}><Text style={s.body}>Gasto promedio por día</Text><Text style={s.body}>{money(flexSpent / elapsed)}</Text></View>
          </Card>
        </>
      )}

      </View>
      <View style={wide ? s.col : null}>
      {limitRows.length > 0 && (
        <>
          <Title>Límites del mes</Title>
          <Card>
            {limitRows.map(([cat, lim, sp], i) => {
              const c = CATS.find((z) => z.name === cat), ratio = sp / lim;
              const col = ratio >= 1 ? '#FF3B30' : ratio >= 0.8 ? '#FF9500' : '#34C759';
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
                  <Text style={[s.body, { color: '#FF3B30' }]}>-{money(u.m.amount, true)}</Text>
                </View>
              );
            })}
            <View style={[s.row, s.sep, { justifyContent: 'space-between' }]}><Text style={s.body}>Total por pagar</Text><Text style={[s.body, { fontWeight: '600' }]}>{money(upcoming.reduce((a, u) => a + u.m.amount, 0), true)}</Text></View>
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
                  <View style={{ flex: 1 }}><Text style={s.body}>{isInc ? m.note || 'Ingreso' : m.note || m.cat}</Text><Text style={s.caption}>{freqLabel(asExp(m))}</Text></View>
                  <Text style={[s.body, { color: isInc ? '#34C759' : '#FF3B30' }]}>{isInc ? '+' : '-'}{money(m.amount, true)}</Text>
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
