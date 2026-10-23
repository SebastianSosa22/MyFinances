import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { TABS } from '../constants/navigation';
import { s } from '../theme/styles';

// Ajustes va en el encabezado (círculo verde); el resto va en la barra inferior
const HEADER_KEYS = ['settings'];

// Píldora flotante: pestañas a la izquierda, botón + al centro, pestañas a la derecha
export function TabBar({ tab, setTab, onAdd }) {
  const items = TABS.filter((t) => !HEADER_KEYS.includes(t.key));
  const mid = Math.ceil(items.length / 2);
  const render = (item) => {
    const on = tab === item.key;
    return (
      <Pressable key={item.key} style={s.tab} onPress={() => setTab(item.key)}>
        <Text style={{ fontSize: 22, opacity: on ? 1 : 0.5 }}>{item.icon}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[s.tabLabel, on && { color: '#6FD18F', fontWeight: '600' }]}>{item.label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={s.tabbar}>
      <View style={s.tabGroup}>{items.slice(0, mid).map(render)}</View>
      <Pressable style={s.tabFab} onPress={onAdd}><Text style={s.tabFabText}>+</Text></Pressable>
      <View style={s.tabGroup}>{items.slice(mid).map(render)}</View>
    </View>
  );
}