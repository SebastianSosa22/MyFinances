import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, RefreshControl } from 'react-native';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { Segmented } from './components/ui';
import { Onboarding } from './components/Onboarding';
import { useFinanceData } from './hooks/useFinanceData';
import { useReminders } from './hooks/useReminders';
import { useWide } from './hooks/useWide';
import { GoalsScreen } from './screens/GoalsScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { MovesScreen } from './screens/MovesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AddMovementSheet } from './sheets/AddMovementSheet';
import { ContributeSheet } from './sheets/ContributeSheet';
import { GoalSheet } from './sheets/GoalSheet';
import { s } from './theme/styles';
import { useUserSettings } from './hooks/useUserSettings';
import { SavingsScreen } from './screens/SavingsScreen';
import { usePush } from './hooks/usePush';
import { ReleaseNotice } from './components/ReleaseNotice';
import { useReleaseNotice } from './hooks/useReleaseNotice';
import { IdleWarning } from './components/IdleWarning';
import { useIdleLogout } from './hooks/useIdleLogout';
import { periodStart } from './lib/dates';
import { C } from './theme/colors';
import { firstName } from './lib/auth';

// Estructura de la app: barra lateral (escritorio) o barra inferior (móvil), pantalla activa y hojas
export function AppShell({ session }) {
  const wide = useWide();
  const [tab, setTab] = useState('home');
  const [backTab, setBackTab] = useState('home'); // pestaña a la que regresa Ajustes
  const [savingsView, setSavingsView] = useState('box'); // dentro de Ahorro: 'box' (caja) o 'goals' (metas)
  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [goalSheet, setGoalSheet] = useState({ open: false, goal: null });
  const [contrib, setContrib] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const data = useFinanceData(session);
  const [rem, setReminders] = useReminders(data.moves, data.setNotice);
  const [settings, saveSettings, settingsLoaded] = useUserSettings(session);
  const push = usePush(rem);
  const notice = useReleaseNotice(session);
  const idle = useIdleLogout();
  const { moves, goals, limits } = data;

  // Al cambiar de pestaña (o entre Caja y Metas) la pantalla vuelve arriba
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTo({ y: 0, animated: false }); }, [tab, savingsView]);

  const toggleSettings = () => { if (tab === 'settings') setTab(backTab); else { setBackTab(tab); setTab('settings'); } };

  const goalsMode = tab === 'savings' && savingsView === 'goals';
  const openAdd = () => (goalsMode ? setGoalSheet({ open: true, goal: null }) : (setEditRow(null), setAddOpen(true)));
  const openEdit = (m) => { setEditRow(m); setAddOpen(true); };
  const closeAdd = () => { setAddOpen(false); setEditRow(null); };
  const refresh = async () => { setRefreshing(true); await data.load(); setRefreshing(false); };

  // Asistente de bienvenida: solo para cuentas nuevas (sin movimientos y que no lo han completado)
  const showOnboarding = data.loaded && settingsLoaded && !settings.onboarded && moves.length === 0;
  const finishOnboarding = async ({ cycle, payDay, mday, split, amount }) => {
    await saveSettings({ cycle, payDay, split, onboarded: true });
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

  return (
    <View style={wide ? s.shellWide : s.container} {...idle.activityProps}>
      {wide && <Sidebar tab={tab} setTab={setTab} email={session.user.email} onAdd={openAdd} goalsMode={goalsMode} />}
      {!wide && (
        <View style={s.headerBar}>
          <Pressable style={[s.circleBtn, s.circleGreen, tab === 'settings' && s.circleOn]} onPress={toggleSettings}><Text style={s.circleGlyph}>⚙</Text></Pressable>
        </View>
      )}
      <ScrollView
        ref={scrollRef}
        style={wide ? { flex: 1 } : null}
        contentContainerStyle={wide ? s.contentWide : { padding: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.muted} />}
      >
        {!!data.err && <Text style={[s.hint, { color: '#F87171', marginBottom: 8 }]}>{data.err}</Text>}
        {!!data.notice && <Pressable onPress={() => data.setNotice('')}><Text style={[s.hint, { color: '#FBBF24', marginBottom: 8 }]}>{data.notice}</Text></Pressable>}

        {tab === 'home' && <HomeScreen name={firstName(session.user)} moves={moves} limits={limits} settings={settings} loading={!data.loaded} onSeeAll={() => setTab('moves')} />}
        {tab === 'savings' && (
          <>
            <Text style={s.largeTitle}>{savingsView === 'box' ? 'Caja de ahorro' : 'Metas'}</Text>
            <Segmented options={{ box: { label: 'Caja' }, goals: { label: 'Metas' } }} value={savingsView} onChange={setSavingsView} />
            {savingsView === 'box'
              ? <SavingsScreen moves={moves} settings={settings} />
              : <GoalsScreen goals={goals} moves={moves} onSave={data.saveGoal} onDelete={data.delGoal}
                onEdit={(goal) => setGoalSheet({ open: true, goal })} onContribute={setContrib} />}
          </>
        )}
        {tab === 'moves' && <MovesScreen moves={moves} loading={!data.loaded} onDelete={data.delMove} onEdit={openEdit} />}
        {tab === 'history' && <HistoryScreen moves={moves} />}
        {tab === 'settings' && (
          <SettingsScreen onBack={wide ? null : () => setTab(backTab)} session={session} moves={moves} limits={limits} settings={settings} onSaveSettings={saveSettings} push={push} idle={idle} rem={rem} setReminders={setReminders} onSaveLimit={data.saveLimit} onApplyLimits={data.applyLimits} />
        )}
      </ScrollView>

      {/* {!wide && <TabBar tab={tab} setTab={setTab} onAdd={openAdd} showAdd={tab !== 'settings' && tab !== 'history'} />} */}
      {!wide && <TabBar tab={tab} setTab={setTab} onAdd={openAdd} />}


      {!!data.undo && (
        <View style={[s.snackbar, wide && { bottom: 24 }]}>
          <Text style={s.snackText}>Movimiento borrado</Text>
          <Pressable onPress={data.undoDelete} hitSlop={10}><Text style={s.snackLink}>Deshacer</Text></Pressable>
        </View>
      )}

      <AddMovementSheet visible={addOpen} edit={editRow} moves={moves} onClose={closeAdd} onAdd={data.addMove} onUpdate={data.updateMove} onDelete={data.delMove} />
      <GoalSheet visible={goalSheet.open} goal={goalSheet.goal} onClose={() => setGoalSheet({ open: false, goal: null })} onSave={data.saveGoal} />
      <IdleWarning visible={idle.warning} seconds={idle.secondsLeft} onStay={idle.stay} onLogout={idle.logoutNow} />
      <ReleaseNotice visible={notice.visible} onClose={notice.dismiss} />
      <ContributeSheet goal={contrib} onClose={() => setContrib(null)} onSubmit={data.contribute} />
      <Onboarding visible={showOnboarding} onDone={finishOnboarding} onSkip={() => saveSettings({ onboarded: true })} />
    </View>
  );
}
