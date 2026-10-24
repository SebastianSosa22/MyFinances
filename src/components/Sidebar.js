import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { TABS } from '../constants/navigation';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

export function Sidebar({ tab, setTab, onAdd, email, tabs = TABS }) {
  return (
    <View style={s.sidebar}>
      <Text style={s.brand}>Finanzas Personales</Text>
      <Pressable style={s.addBtn} onPress={onAdd}>
        <Text style={s.addBtnText}>+ Nuevo movimiento</Text>
      </Pressable>
      {tabs.map((item) => (
        <Pressable key={item.key} onPress={() => setTab(item.key)} style={[s.navItem, tab === item.key && s.navActive]}>
          <Text style={{ fontSize: 18, marginRight: 10 }}>{item.icon}</Text>
          <Text style={[s.navText, tab === item.key && { color: C.link, fontWeight: '600' }]}>{item.label}</Text>
        </Pressable>
      ))}
      <View style={{ flex: 1 }} />
      <Text style={[s.caption, { paddingHorizontal: 0 }]} numberOfLines={1}>{email}</Text>
    </View>
  );
}