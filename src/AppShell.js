import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, RefreshControl } from 'react-native';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
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

// Estructura de la app: barra lateral (escritorio) o barra inferior (móvil), pantalla activa y hojas
export function AppShell({ session }) {
  const wide = useWide();
  const [tab, setTab] = useState('home');
  const [addOpen, setAddOpen] = useState(false);
  const [goalSheet, setGoalSheet] = useState({ open: false, goal: null });
  const [contrib, setContrib] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const data = useFinanceData(session);
  const [rem, setReminders] = useReminders(data.moves, data.setNotice);
  const [settings, saveSettings] = useUserSettings(session);
  const { moves, goals, limits } = data;

  const openAdd = () => (tab === 'goals' ? setGoalSheet({ open: true, goal: null }) : setAddOpen(true));
  const refresh = async () => { setRefreshing(true); await data.load(); setRefreshing(false); };

  return (
    <View style={wide ? s.shellWide : s.container}>
      {wide && <Sidebar tab={tab} setTab={setTab} email={session.user.email} onAdd={openAdd} />}
      <ScrollView
        style={wide ? { flex: 1 } : null}
        contentContainerStyle={wide ? s.contentWide : { padding: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {!!data.err && <Text style={[s.hint, { color: '#FF3B30', marginBottom: 8 }]}>{data.err}</Text>}
        {!!data.notice && <Pressable onPress={() => data.setNotice('')}><Text style={[s.hint, { color: '#FF9500', marginBottom: 8 }]}>{data.notice}</Text></Pressable>}

        {tab === 'home' && <HomeScreen moves={moves} limits={limits} settings={settings} onSeeAll={() => setTab('moves')} />}
        {tab === 'savings' && <SavingsScreen moves={moves} settings={settings} />}
        {tab === 'moves' && <MovesScreen moves={moves} onDelete={data.delMove} />}
        {tab === 'goals' && (
          <GoalsScreen goals={goals} moves={moves} onSave={data.saveGoal} onDelete={data.delGoal}
            onEdit={(goal) => setGoalSheet({ open: true, goal })} onContribute={setContrib} />
        )}
        {tab === 'history' && <HistoryScreen moves={moves} />}
        {tab === 'settings' && (
          <SettingsScreen session={session} moves={moves} limits={limits} settings={settings} onSaveSettings={saveSettings} rem={rem} setReminders={setReminders} onSaveLimit={data.saveLimit} />
        )}
      </ScrollView>

      {!wide && tab !== 'settings' && tab !== 'history' && (
        <Pressable style={s.fab} onPress={openAdd}><Text style={s.fabText}>+</Text></Pressable>
      )}
      {!wide && <TabBar tab={tab} setTab={setTab} />}

      <AddMovementSheet visible={addOpen} onClose={() => setAddOpen(false)} onAdd={data.addMove} />
      <GoalSheet visible={goalSheet.open} goal={goalSheet.goal} onClose={() => setGoalSheet({ open: false, goal: null })} onSave={data.saveGoal} />
      <ContributeSheet goal={contrib} onClose={() => setContrib(null)} onSubmit={data.contribute} />
    </View>
  );
}
