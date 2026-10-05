import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { TABS } from '../constants/navigation';
import { s } from '../theme/styles';

export function TabBar({ tab, setTab }) {
  return (
    <View style={s.tabbar}>
      {TABS.map((item) => (
        <Pressable key={item.key} style={s.tab} onPress={() => setTab(item.key)}>
          <Text style={{ fontSize: 22, opacity: tab === item.key ? 1 : 0.45 }}>{item.icon}</Text>
          <Text style={[s.tabLabel, tab === item.key && { color: '#007AFF' }]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
