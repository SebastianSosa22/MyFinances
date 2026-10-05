import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { TABS } from '../constants/navigation';
import { s } from '../theme/styles';

export function Sidebar({ tab, setTab, onAdd, email }) {
  return (
    <View style={s.sidebar}>
      <Text style={s.brand}>Finanzas</Text>
      <Pressable style={s.addBtn} onPress={onAdd}>
        <Text style={s.addBtnText}>{tab === 'goals' ? '+ Nueva meta' : '+ Nuevo movimiento'}</Text>
      </Pressable>
      {TABS.map((item) => (
        <Pressable key={item.key} onPress={() => setTab(item.key)} style={[s.navItem, tab === item.key && s.navActive]}>
          <Text style={{ fontSize: 18, marginRight: 10 }}>{item.icon}</Text>
          <Text style={[s.navText, tab === item.key && { color: '#007AFF', fontWeight: '600' }]}>{item.label}</Text>
        </Pressable>
      ))}
      <View style={{ flex: 1 }} />
      <Text style={[s.caption, { paddingHorizontal: 0 }]} numberOfLines={1}>{email}</Text>
    </View>
  );
}
