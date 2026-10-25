import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { TABS } from '../constants/navigation';
import { useTourRef } from './Tour';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

export function Sidebar({ tab, setTab, onAdd, email, tabs = TABS }) {
  // Elementos que señala la guía interactiva (Ajustes hace de "perfil" en computadora)
  const refs = { moves: useTourRef('tab-moves'), history: useTourRef('tab-history'), savings: useTourRef('tab-savings'), settings: useTourRef('profile') };
  const addRef = useTourRef('add');
  return (
    <View style={s.sidebar}>
      <Text style={s.brand}>Finanzas Personales</Text>
      <Pressable ref={addRef} style={s.addBtn} onPress={onAdd}>
        <Text style={s.addBtnText}>+ Nuevo movimiento</Text>
      </Pressable>
      {tabs.map((item) => (
        <Pressable key={item.key} ref={refs[item.key]} onPress={() => setTab(item.key)} style={[s.navItem, tab === item.key && s.navActive]}>
          <Text style={{ fontSize: 18, marginRight: 10 }}>{item.icon}</Text>
          <Text style={[s.navText, tab === item.key && { color: C.link, fontWeight: '600' }]}>{item.label}</Text>
        </Pressable>
      ))}
      <View style={{ flex: 1 }} />
      <Text style={[s.caption, { paddingHorizontal: 0 }]} numberOfLines={1}>{email}</Text>
    </View>
  );
}