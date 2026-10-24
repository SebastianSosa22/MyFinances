import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from './Icon';
import { TABS } from '../constants/navigation';
import { C } from '../theme/colors';
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
        <Icon name={item.glyph} size={24} color={on ? C.link : C.muted} />
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[s.tabLabel, on && { color: C.link, fontWeight: '600' }]}>{item.label}</Text>
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