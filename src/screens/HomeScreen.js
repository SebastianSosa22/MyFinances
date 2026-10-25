import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { BalanceCard, BudgetCard, Greeting, HIDDEN, SpentHero } from '../components/HomeCards';
import { Delta } from '../components/Delta';
import { MonthCalendar } from '../components/MonthCalendar';
import { Card, Segmented, Title } from '../components/ui';
import { CATS, PERIODS } from '../constants/budget';
import { useWide } from '../hooks/useWide';
import { startOfMonth } from '../lib/dates';
import { accountsSummary, cardsDue } from '../lib/accounts';
import { calendarDays } from '../lib/finance';
import { money, shortDate } from '../lib/format';
import { balanceSummary, homeSummary, outflowOf, periodView } from '../lib/summary';
import { AccountRow } from './AccountsScreen';
import { s } from '../theme/styles';

export function HomeScreen({ name, moves, accounts = [], transfers = [], onSeeAccounts, limits, settings, loading, hide, onToggleHide, onSeeAll, onSeeDay, onSeeHistory, onSeeSavings }) {
  const wide = useWide();
  const [pick, setPick] = useState(null);
  const [calMonth, setCalMonth] = useState(() => startOfMonth(new Date()));
  const period = pick || settings.cycle; // el Resumen abre en TU ciclo de cobro
  const dayKey = new Date().toDateString();
  const sm = useMemo(() => homeSummary(moves, limits, period, new Date(), settings.payDay), [moves, limits, period, settings.payDay, settings.split, dayKey]);
  const view = useMemo(() => periodView(moves, period, new Date(), settings.payDay), [moves, period, settings.payDay, dayKey]);
  const balance = useMemo(() => balanceSummary(moves), [moves, dayKey]);
  const hasIncome = moves.some((m) => m.kind === 'income');
  const acc = useMemo(() => accountsSummary(accounts, moves, transfers), [accounts, moves, transfers, dayKey]);
  const cards = useMemo(() => cardsDue(accounts, moves, transfers, new Date(), sm.end), [accounts, moves, transfers, sm.end, dayKey]);
  const calDays = useMemo(() => calendarDays(moves, calMonth), [moves, calMonth]);
  const { now, start, end, prev, upcoming } = sm;
  const { income } = view;

  const greeting = <Greeting name={name} hide={hide} onToggleHide={onToggleHide} />;

  if (loading) {
    return (<>{greeting}<ActivityIndicator style={{ marginTop: 40 }} /></>);
  }

  const fmt = hide ? () => HIDDEN : money;

  return (
    <>
      {greeting}
      <Segmented options={PERIODS} value={period} onChange={setPick} style={s.segCard} />
      <View style={s.dateRow}>
        <Text style={s.dateText}>{shortDate(start)} – {shortDate(end)}</Text>
        <Text style={s.dateText}>Hoy, {shortDate(now)}</Text>
      </View>
      <View style={wide ? [s.cols, { alignItems: 'stretch' }] : null}>
        <View style={wide ? s.col : null}>
          <SpentHero period={period} now={now} income={income} spent={view.outflow} saved={view.saved} left={view.left} hide={hide} onPress={onSeeHistory} onSaved={onSeeSavings} />
        </View>
        <View style={wide ? [s.col, { justifyContent: 'flex-end' }] : null}>
          <BalanceCard balance={balance} pending={view.pending} pendingSpread={view.pendingSpread} cards={cards} end={end} hide={hide} onBalance={onSeeSavings} onPending={onSeeAll} onCards={onSeeAccounts} />
        </View>
      </View>
      <Title>Tus cuentas</Title>
      <View style={s.card}>
        {acc.rows.length === 0
          ? (
            <Pressable style={{ padding: 16 }} onPress={onSeeAccounts}>
              <Text style={[s.body, { fontWeight: '600' }]}>Registra tus tarjetas y tu efectivo</Text>
              <Text style={s.balanceSub}>Lleva el saldo de cada cuenta y lo que debes en tus tarjetas de crédito.</Text>
            </Pressable>
          ) : (
            <>
              <View style={[s.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
                <Text style={s.balanceSub}>Disponible <Text style={{ color: acc.cash < 0 ? '#F87171' : '#fff', fontWeight: '600' }}>{fmt(acc.cash, true)}</Text></Text>
                {acc.debt > 0 && <Text style={s.balanceSub}>Deuda en tarjetas <Text style={{ color: '#F87171', fontWeight: '600' }}>{fmt(acc.debt, true)}</Text></Text>}
              </View>
              {acc.rows.slice(0, 4).map((r) => <AccountRow key={r.a.id} row={r} hide={hide} onPress={onSeeAccounts} />)}
            </>
          )}
        <Pressable style={[s.row, s.sep, { justifyContent: 'center' }]} onPress={onSeeAccounts}><Text style={s.link}>{acc.rows.length ? 'Ver cuentas' : '+ Agregar cuenta'}</Text></Pressable>
      </View>
      {!hasIncome && (
        <View style={[s.card, { padding: 16 }]}>
          <Text style={[s.body, { fontWeight: '600' }]}>Empieza registrando tu ingreso</Text>
          <Text style={s.balanceSub}>Toca + y registra lo que cobras (o tu nómina) para ver cuánto te toca gastar y ahorrar.</Text>
        </View>
      )}
      <View style={wide ? s.cols : null}>
        <View style={wide ? s.col : null}>
          {income > 0
            ? <BudgetCard spent={view.spent} income={income} spentPct={view.spentPct} fixedShare={view.fixedShare} smooth={period !== 'monthly'} hide={hide} />
            : hasIncome && <View style={[s.card, { padding: 16 }]}><Text style={s.balanceLabel}>Tu reparto</Text><Text style={s.balanceSub}>No hay ingresos en este periodo. Elige Mes para ver tu reparto.</Text></View>}
        </View>
        <View style={wide ? s.col : null}>
          {moves.length > 0 && (
            <View style={s.card}>
              <MonthCalendar month={calMonth} onMonth={setCalMonth} days={calDays} selected={null} onSelect={(key) => key && onSeeDay(key)} />
              <Pressable style={[s.row, s.sep, { justifyContent: 'center' }]} onPress={() => onSeeAll()}><Text style={s.link}>Ver más detalles</Text></Pressable>
            </View>
          )}
        </View>
      </View>
      <View style={wide ? s.cols : null}>
        <View style={wide ? s.col : null}>
          {upcoming.length > 0 && (
            <>
              <Title>Próximos 7 días</Title>
              <Card>
                {upcoming.map((u, i) => {
                  const c = CATS.find((z) => z.name === u.m.cat);
                  return (
                    <View key={u.m.id + '-' + i} style={[s.row, i > 0 && s.sep]}>
                      <Text style={{ fontSize: 22, marginRight: 12 }}>{c ? c.icon : '🧾'}</Text>
                      <View style={{ flex: 1 }}><Text style={s.body}>{u.m.note || u.m.cat}</Text><Text style={s.caption}>{u.d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}</Text></View>
                      <Text style={[s.body, { color: '#F87171' }]}>-{fmt(u.m.amount, true)}</Text>
                    </View>
                  );
                })}
                <View style={[s.row, s.sep, { justifyContent: 'space-between' }]}><Text style={s.body}>Total por pagar</Text><Text style={[s.body, { fontWeight: '600' }]}>{fmt(upcoming.reduce((a, u) => a + u.m.amount, 0), true)}</Text></View>
              </Card>
            </>
          )}

        </View>
        <View style={wide ? s.col : null}>

          {prev && (prev.total > 0 || prev.income > 0) && (
            <>
              <Title>Vs. el mes pasado a esta fecha</Title>
              <Card>
                <View style={s.row}>
                  <View style={{ flex: 1 }}><Text style={s.caption}>Ingresos</Text><Text style={[s.body, { paddingHorizontal: 16 }]}>{fmt(income)}</Text><Text style={s.caption}>antes {fmt(prev.income)}</Text><Delta now={income} prev={prev.income} upIsGood /></View>
                  <View style={{ flex: 1 }}><Text style={s.caption}>Gastos</Text><Text style={[s.body, { paddingHorizontal: 16 }]}>{fmt(view.outflow)}</Text><Text style={s.caption}>antes {fmt(outflowOf(prev))}</Text><Delta now={view.outflow} prev={outflowOf(prev)} upIsGood={false} /></View>
                </View>
              </Card>
            </>
          )}
        </View>
      </View>
    </>
  );
}
