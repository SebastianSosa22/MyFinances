import React, { useState, useMemo } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { HealthCard } from '../components/HealthCard';
import { AvailableHero, BudgetCard, HomeHeader, MoneyTiles, UpcomingPanel } from '../components/HomeCards';
import { TourTarget } from '../components/Tour';
import { Panel, Segmented } from '../components/ui';
import { CATS, PERIODS } from '../constants/budget';
import { useWide } from '../hooks/useWide';
import { accountsSummary, cardsDue } from '../lib/accounts';
import { financialHealth } from '../lib/health';
import { emergencySaved } from '../lib/emergency';
import { balanceSummary, homeSummary, outflowOf, periodView } from '../lib/summary';
import { s } from '../theme/styles';

// Inicio (diseño "Bóveda nocturna"): encabezado, Disponible, Tu reparto, cuentas y ahorro, y los próximos pagos
export function HomeScreen({ name, upcomingItems, emergencyMonths, goals = [], moves, accounts = [], transfers = [], onSeeAccounts, limits, settings, loading, hide, onToggleHide, onSeeAll, onSeeHistory, onSeeSavings, onAdd, headerActions }) {
  const wide = useWide();
  const [pick, setPick] = useState(null);
  const period = pick || settings.cycle; // el Inicio abre en TU ciclo de cobro
  const dayKey = new Date().toDateString();
  const sm = useMemo(() => homeSummary(moves, limits, period, new Date(), settings.payDay), [moves, limits, period, settings.payDay, settings.split, dayKey]);
  const view = useMemo(() => periodView(moves, period, new Date(), settings.payDay), [moves, period, settings.payDay, dayKey]);
  const balance = useMemo(() => balanceSummary(moves), [moves, dayKey]);
  const hasIncome = moves.some((m) => m.kind === 'income');
  const acc = useMemo(() => accountsSummary(accounts, moves, transfers), [accounts, moves, transfers, dayKey]);
  const cards = useMemo(() => cardsDue(accounts, moves, transfers, new Date(), sm.end), [accounts, moves, transfers, sm.end, dayKey]);
  const emergency = useMemo(() => emergencySaved(moves, goals), [moves, goals, dayKey]);
  const health = useMemo(() => financialHealth(moves, { limits, acc, saved: emergency.saved, emergencyMonths }), [moves, limits, acc, emergency.saved, emergencyMonths, settings.split, dayKey]);
  const { start, end, prev } = sm;
  // Misma lista que la campana (incluye pagos de tarjeta), para que las cifras coincidan
  const upcoming = upcomingItems || sm.upcoming;
  const { income } = view;

  const header = <HomeHeader name={name} period={period} start={start} end={end} hide={hide} onToggleHide={onToggleHide} actions={headerActions} />;
  const periodPicker = <TourTarget id="period"><Segmented options={PERIODS} value={period} onChange={setPick} style={{ marginTop: 14 }} /></TourTarget>;

  if (loading) {
    return (<>{header}<ActivityIndicator style={{ marginTop: 40 }} /></>);
  }

  const hero = (
    <TourTarget id="hero">
      <AvailableHero period={period} income={income} spent={view.outflow} saved={view.saved} left={view.left} pending={view.pending + cards.total} end={end}
        prevSpent={prev ? outflowOf(prev) : 0} hide={hide} onPress={onSeeHistory} onSaved={onSeeSavings} onPending={onSeeAll} />
    </TourTarget>
  );
  const budget = income > 0
    ? <BudgetCard spent={view.spent} income={income} spentPct={view.spentPct} fixedShare={view.fixedShare} smooth={period !== 'monthly'} hide={hide} onMore={onSeeHistory} />
    : hasIncome && <Panel title="Tu reparto"><Text style={s.smallMuted}>No hay ingresos en este periodo. Elige Mes para ver tu reparto.</Text></Panel>;
  const tiles = (
    <TourTarget id="accounts">
      <MoneyTiles acc={acc} saved={balance.saved} savedNow={view.saved} hide={hide} onAccounts={onSeeAccounts} onSavings={onSeeSavings} />
    </TourTarget>
  );
  const icon = (u) => { if (u.icon) return u.icon; const c = CATS.find((z) => z.name === u.m.cat); return c ? c.icon : '🧾'; };

  // Cuenta nueva sin movimientos: en vez de cifras en cero, una bienvenida con el primer paso
  if (moves.length === 0) {
    return (
      <>
        {header}
        <Panel style={{ padding: 20 }}>
          <Text style={s.eyebrow}>Primer paso</Text>
          <Text style={[s.homeTitle, { fontSize: 22 }]}>Registra lo que cobras</Text>
          <Text style={s.smallMuted}>Con tu ingreso calculamos cuánto te toca para necesidades, deseos y ahorro, y cuánto tienes disponible cada semana.</Text>
          <Pressable accessibilityRole="button" style={[s.button, { marginTop: 4 }]} onPress={onAdd}><Text style={s.buttonText}>+ Registrar mi ingreso</Text></Pressable>
        </Panel>
        {tiles}
      </>
    );
  }

  return (
    <>
      {header}
      {periodPicker}
      <View style={wide ? [s.cols, { alignItems: 'stretch' }] : null}>
        <View style={wide ? s.col : null}>
          {hero}
          {tiles}
        </View>
        <View style={wide ? s.col : null}>
          {budget}
          <HealthCard health={health} />
          {upcoming.length > 0 && <UpcomingPanel items={upcoming} icons={icon} hide={hide} />}
        </View>
      </View>
      {!hasIncome && (
        <Panel title="Empieza registrando tu ingreso">
          <Text style={s.smallMuted}>Toca + y registra lo que cobras (o tu nómina) para ver cuánto te toca gastar y ahorrar.</Text>
        </Panel>
      )}
    </>
  );
}
