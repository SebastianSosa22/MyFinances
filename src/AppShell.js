import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, Pressable, ScrollView, RefreshControl } from 'react-native';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { Segmented } from './components/ui';
import { Onboarding } from './components/Onboarding';
import { useFinanceData } from './hooks/useFinanceData';
import { useReminders } from './hooks/useReminders';
import { useWide } from './hooks/useWide';
import { AnalysisScreen } from './screens/AnalysisScreen';
import { HomeScreen } from './screens/HomeScreen';
import { MovesScreen } from './screens/MovesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AddMovementSheet } from './sheets/AddMovementSheet';
import { AccountSheet } from './sheets/AccountSheet';
import { AdjustSheet, TransferSheet } from './sheets/TransferSheet';
import { AccountsScreen } from './screens/AccountsScreen';
import { ContributeSheet } from './sheets/ContributeSheet';
import { GoalSheet } from './sheets/GoalSheet';
import { s } from './theme/styles';
import { useUserSettings } from './hooks/useUserSettings';
import { BudgetsScreen } from './screens/BudgetsScreen';
import { SavingScreen } from './screens/SavingScreen';
import { BudgetSheet } from './sheets/BudgetSheet';
import { usePush } from './hooks/usePush';
import { ReleaseNotice } from './components/ReleaseNotice';
import { useReleaseNotice } from './hooks/useReleaseNotice';
import { IdleWarning } from './components/IdleWarning';
import { useIdleLogout } from './hooks/useIdleLogout';
import { periodStart } from './lib/dates';
import { C } from './theme/colors';
import { firstName, initials } from './lib/auth';
import { ADMIN_TAB, TABS } from './constants/navigation';
import { useRole } from './hooks/useRole';
import { track, trackScreen } from './lib/analytics';
import { AdminScreen } from './screens/AdminScreen';
import { Icon } from './components/Icon';
import { SideDrawer } from './components/SideDrawer';
import { Tour, TourTargets } from './components/Tour';
import { UpcomingSheet } from './components/UpcomingSheet';
import { useHideAmounts } from './hooks/useHideAmounts';
import { upcomingPayments } from './lib/summary';
import { cardAlerts } from './lib/accounts';

// Estructura de la app: barra lateral (escritorio) o barra inferior (móvil), pantalla activa y hojas
export function AppShell({ session }) {
  const wide = useWide();
  const [pickedTab, setTab] = useState('home');
  const [backTab, setBackTab] = useState('home'); // pestaña a la que regresa el panel de Admin
  const [savingsView, setSavingsView] = useState('budgets'); // dentro de Presupuestos: 'budgets' o 'saving' (ahorro y metas)
  const [budgetSheet, setBudgetSheet] = useState({ open: false, edit: null, n: 0 });
  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState(0); // se cambia al abrir para que la hoja arranque limpia (o con el movimiento a editar)
  const [editRow, setEditRow] = useState(null);
  const [goalSheet, setGoalSheet] = useState({ open: false, goal: null });
  const [contrib, setContrib] = useState(null);
  const [accountSheet, setAccountSheet] = useState({ open: false, account: null, n: 0 });
  const [transferSheet, setTransferSheet] = useState({ open: false, start: {}, edit: null, n: 0 });
  const [adjustAccount, setAdjustAccount] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false); // móvil: Ajustes en el panel lateral
  const [movesDay, setMovesDay] = useState(null); // día que abre Movimientos al tocarlo en el calendario del Resumen
  const [hide, toggleHide] = useHideAmounts();

  const data = useFinanceData(session);
  const [rem, setReminders] = useReminders(data.moves, data.setNotice, data.accounts, data.transfers);
  const [settings, saveSettings, settingsLoaded] = useUserSettings(session);
  const push = usePush(rem);
  const notice = useReleaseNotice(session);
  const idle = useIdleLogout();
  const { isAdmin } = useRole(session);
  // Si la cuenta deja de ser admin, sale del panel
  const tab = pickedTab === 'admin' && !isAdmin ? 'home' : pickedTab;
  const { moves, goals, limits, accounts, transfers } = data;
  const dayKey = new Date().toDateString();
  // Campana: pagos fijos de los próximos 7 días y pagos de tarjetas de crédito que vencen en ese tiempo
  const upcoming = useMemo(() => {
    const cards = cardAlerts(accounts, moves, transfers, new Date(), 7).filter((x) => x.kind === 'due')
      .map((x) => ({ m: { id: 'card-' + x.a.id, note: 'Pago de tarjeta ' + x.a.name, amount: x.debt }, d: x.d, icon: '💳' }));
    return [...upcomingPayments(moves, new Date(), 7), ...cards].sort((a, b) => a.d - b.d);
  }, [moves, accounts, transfers, dayKey]);

  // Al cambiar de pestaña (o entre Presupuestos y Ahorro) la pantalla vuelve arriba
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTo({ y: 0, animated: false }); }, [tab, savingsView]);
  // Bitácora de uso: qué pantalla se abre (Presupuestos se separa en Presupuestos y Ahorro)
  useEffect(() => { trackScreen(settingsOpen ? 'settings' : tab === 'savings' ? 'savings_' + savingsView : tab); }, [tab, savingsView, settingsOpen]);

  // Admin se abre desde el encabezado del móvil y regresa a la pestaña anterior
  const toggleHeader = (key) => { if (tab === key) setTab(backTab); else { if (tab !== 'settings' && tab !== 'admin') setBackTab(tab); setTab(key); } };
  const tabs = isAdmin ? [...TABS, ADMIN_TAB] : TABS;
  // Desde la barra de pestañas, Movimientos abre sin día elegido
  const goTab = (key) => { setMovesDay(null); setTab(key); };

  const openAdd = () => { setEditRow(null); setAddKey((k) => k + 1); setAddOpen(true); };
  const openBudget = (edit) => setBudgetSheet((b) => ({ open: true, edit, n: b.n + 1 }));
  const openEdit = (m) => { setEditRow(m); setAddKey((k) => k + 1); setAddOpen(true); };
  const openAccount = (account) => setAccountSheet((x) => ({ open: true, account, n: x.n + 1 }));
  const openTransfer = (start, edit = null) => setTransferSheet((x) => ({ open: true, start: start || {}, edit, n: x.n + 1 }));
  const closeAdd = () => { setAddOpen(false); setEditRow(null); };
  const refresh = async () => { setRefreshing(true); await data.load(); setRefreshing(false); };

  // Asistente de bienvenida: solo para cuentas nuevas (sin movimientos y que no lo han completado)
  const showOnboarding = data.loaded && settingsLoaded && !settings.onboarded && moves.length === 0;

  // Guía interactiva: se muestra una vez (después de la bienvenida) y se puede repetir desde Ajustes. Se recuerda en el dispositivo.
  const [tourTargets] = useState(() => new Map());
  const [tour, setTour] = useState({ on: false, n: 0 });
  const [tourDone, setTourDone] = useState(null); // null mientras se lee del dispositivo
  const tourKey = 'tour_done_' + session.user.id;
  const bellRef = useRef(null), profileRef = useRef(null);
  const scrollY = useRef(0);
  useEffect(() => { AsyncStorage.getItem(tourKey).then((v) => setTourDone(v === '1')).catch(() => setTourDone(false)); }, [tourKey]);
  // En el móvil, la campana y el círculo de perfil del encabezado también se señalan en la guía
  useEffect(() => {
    if (wide) return undefined;
    tourTargets.set('bell', bellRef); tourTargets.set('profile', profileRef);
    return () => { if (tourTargets.get('bell') === bellRef) tourTargets.delete('bell'); if (tourTargets.get('profile') === profileRef) tourTargets.delete('profile'); };
  }, [wide, tourTargets]);
  const openTour = () => setTour((t) => ({ on: true, n: t.n + 1 }));
  useEffect(() => {
    if (tourDone !== false || tour.on || !data.loaded || !settingsLoaded || showOnboarding || notice.visible || tab !== 'home') return undefined;
    const t = setTimeout(() => { track('tour_start', { auto: true }); openTour(); }, 800);
    return () => clearTimeout(t);
  }, [tourDone, tour.on, data.loaded, settingsLoaded, showOnboarding, notice.visible, tab]);
  const startTour = () => {
    track('tour_start', { auto: false });
    setSettingsOpen(false); setTab('home');
    if (scrollRef.current) scrollRef.current.scrollTo({ y: 0, animated: false });
    setTimeout(openTour, 450); // espera a que se cierre el panel de Ajustes y se dibuje el Inicio
  };
  const closeTour = () => {
    setTour((t) => ({ ...t, on: false })); setTourDone(true);
    AsyncStorage.setItem(tourKey, '1').catch(() => {});
    track('tour_close');
  };
  const scrollBy = useCallback((dy) => { if (scrollRef.current) scrollRef.current.scrollTo({ y: Math.max(0, scrollY.current + dy), animated: false }); }, []);
  const finishOnboarding = async ({ cycle, payDay, mday, split, amount }) => {
    await saveSettings({ cycle, payDay, split, onboarded: true });
    track('onboarding_done', { cycle, split, income: amount > 0 });
    if (amount > 0) {
      // El ingreso recurrente empieza al inicio del ciclo en curso para que ya cuente en este periodo
      const startAt = periodStart(cycle, new Date(), payDay);
      startAt.setHours(12, 0, 0, 0);
      const base = { kind: 'income', amount, note: 'Nómina', occurred_at: startAt.toISOString() };
      if (cycle === 'weekly') await data.addMove({ ...base, freq: 'weekly', day: payDay });
      else if (cycle === 'monthly') await data.addMove({ ...base, freq: 'monthly', day: mday });
      else { await data.addMove({ ...base, freq: 'monthly', day: 15 }); await data.addMove({ ...base, freq: 'monthly', day: 30 }); }
    }
  };

  const settingsScreen = (
    <SettingsScreen session={session} moves={moves} settings={settings} onSaveSettings={saveSettings} push={push} rem={rem} setReminders={setReminders} onStartTour={startTour} />
  );

  return (
    <TourTargets.Provider value={tourTargets}>
    <View style={wide ? s.shellWide : s.container} {...idle.activityProps}>
      {wide && <Sidebar tab={tab} setTab={goTab} email={session.user.email} onAdd={openAdd} tabs={tabs} />}
      {!wide && (
        <View style={s.headerBar}>
          <Pressable ref={profileRef} style={s.avatar} onPress={() => setSettingsOpen(true)} accessibilityLabel="Ajustes y perfil">
            <Text style={s.avatarText}>{initials(session.user)}</Text>
          </Pressable>
          <View style={s.headerRight}>
            {isAdmin && <Pressable style={[s.avatar, tab === 'admin' && s.circleOn]} onPress={() => toggleHeader('admin')} accessibilityLabel="Panel de administrador"><Text style={{ fontSize: 20 }}>📈</Text></Pressable>}
            <Pressable ref={bellRef} style={s.avatar} onPress={() => { track('bell_open', { count: upcoming.length }); setBellOpen(true); }} accessibilityLabel="Próximos pagos">
              <Icon name="bell" size={22} />
              {upcoming.length > 0 && <View style={s.badge}><Text style={s.badgeText}>{upcoming.length > 9 ? '9+' : upcoming.length}</Text></View>}
            </Pressable>
          </View>
        </View>
      )}
      <ScrollView
        ref={scrollRef}
        onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={32}
        style={wide ? { flex: 1 } : null}
        contentContainerStyle={wide ? s.contentWide : { padding: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.muted} />}
      >
        {!!data.err && <Text style={[s.hint, { color: '#F87171', marginBottom: 8 }]}>{data.err}</Text>}
        {!!data.notice && <Pressable onPress={() => data.setNotice('')}><Text style={[s.hint, { color: '#FBBF24', marginBottom: 8 }]}>{data.notice}</Text></Pressable>}

        {tab === 'home' && <HomeScreen name={firstName(session.user)} moves={moves} accounts={accounts} transfers={transfers} onSeeAccounts={() => setTab('accounts')} limits={limits} settings={settings} loading={!data.loaded} hide={hide} onToggleHide={toggleHide} onSeeAll={() => goTab('moves')} onSeeDay={(day) => { setMovesDay(day); setTab('moves'); }} onSeeHistory={() => setTab('history')} onSeeSavings={() => { setSavingsView('saving'); setTab('savings'); }} />}
        {tab === 'savings' && (
          <>
            <View style={s.screenHead}><Text style={s.screenTitle}>{savingsView === 'budgets' ? 'Presupuestos' : 'Ahorro'}</Text></View>
            <Segmented options={{ budgets: { label: 'Presupuestos' }, saving: { label: 'Ahorro' } }} value={savingsView} onChange={setSavingsView} style={s.segCard} />
            {savingsView === 'budgets'
              ? <BudgetsScreen moves={moves} limits={limits} onSaveLimit={data.saveLimit} onApplyLimits={data.applyLimits} onEdit={openBudget} />
              : <SavingScreen moves={moves} goals={goals} onNewGoal={() => setGoalSheet({ open: true, goal: null })}
                onEditGoal={(goal) => setGoalSheet({ open: true, goal })} onDeleteGoal={data.delGoal} onContribute={setContrib} onEditMove={openEdit} />}
          </>
        )}
        {tab === 'moves' && <MovesScreen key={movesDay || 'all'} initialDay={movesDay} moves={moves} accounts={accounts} loading={!data.loaded} onDelete={data.delMove} onEdit={openEdit} />}
        {tab === 'history' && <AnalysisScreen moves={moves} onAdd={openAdd} onSeeMoves={() => goTab('moves')} onSeeDay={(day) => { setMovesDay(day); setTab('moves'); }} />}
        {tab === 'accounts' && <AccountsScreen accounts={accounts} moves={moves} transfers={transfers} hide={hide} onBack={() => setTab('home')} onNew={() => openAccount(null)} onEdit={openAccount} onEditMove={openEdit}
          onTransfer={(start) => openTransfer(start)} onEditTransfer={(t) => openTransfer(null, t)} onAdjust={setAdjustAccount} />}
        {tab === 'admin' && isAdmin && <AdminScreen me={session.user.id} />}
        {tab === 'settings' && wide && settingsScreen}
      </ScrollView>

      {/* {!wide && <TabBar tab={tab} setTab={setTab} onAdd={openAdd} showAdd={tab !== 'settings' && tab !== 'history'} />} */}
      {!wide && !settingsOpen && <TabBar tab={tab} setTab={goTab} onAdd={openAdd} />}


      {!!data.undo && (
        <View style={[s.snackbar, wide && { bottom: 24 }]}>
          <Text style={s.snackText}>Movimiento borrado</Text>
          <Pressable onPress={data.undoDelete} hitSlop={10}><Text style={s.snackLink}>Deshacer</Text></Pressable>
        </View>
      )}

      <AddMovementSheet key={'add' + addKey} visible={addOpen} edit={editRow} moves={moves} goals={goals} accounts={accounts} transfers={transfers} onClose={closeAdd} onAdd={data.addMove} onUpdate={data.updateMove} onDelete={data.delMove} />
      <AccountSheet key={'acc' + accountSheet.n} visible={accountSheet.open} account={accountSheet.account} onClose={() => setAccountSheet((x) => ({ ...x, open: false }))} onSave={data.saveAccount} onDelete={data.delAccount} />
      <TransferSheet key={'tr' + transferSheet.n} visible={transferSheet.open} accounts={accounts} moves={moves} transfers={transfers} start={transferSheet.start} edit={transferSheet.edit}
        onClose={() => setTransferSheet((x) => ({ ...x, open: false }))} onSave={data.saveTransfer} onDelete={data.delTransfer} />
      {!!adjustAccount && <AdjustSheet visible account={adjustAccount} moves={moves} transfers={transfers} onClose={() => setAdjustAccount(null)} onSave={data.saveTransfer} />}
      <GoalSheet visible={goalSheet.open} goal={goalSheet.goal} onClose={() => setGoalSheet({ open: false, goal: null })} onSave={data.saveGoal} />
      {!wide && (
        <SideDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} activityProps={idle.activityProps}>
          {settingsScreen}
        </SideDrawer>
      )}
      <UpcomingSheet visible={bellOpen} items={upcoming} hide={hide} onClose={() => setBellOpen(false)} />
      <IdleWarning visible={idle.warning} seconds={idle.secondsLeft} onStay={idle.stay} onLogout={idle.logoutNow} />
      <ReleaseNotice visible={notice.visible} onClose={notice.dismiss} />
      <BudgetSheet key={'budget' + budgetSheet.n} visible={budgetSheet.open} edit={budgetSheet.edit} limits={limits} onClose={() => setBudgetSheet((b) => ({ ...b, open: false }))} onSave={data.saveLimit} />
      <ContributeSheet goal={contrib} onClose={() => setContrib(null)} onSubmit={data.contribute} />
      <Onboarding visible={showOnboarding} onDone={finishOnboarding} onSkip={() => { track('onboarding_skip'); saveSettings({ onboarded: true }); }} />
      {tour.on && <Tour key={'tour' + tour.n} visible targets={tourTargets} onClose={closeTour} scrollBy={scrollBy} />}
    </View>
    </TourTargets.Provider>
  );
}
