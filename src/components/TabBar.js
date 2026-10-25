import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from './Icon';
import { useTourRef } from './Tour';
import { TABS } from '../constants/navigation';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

// Ajustes va en el encabezado (círculo verde); el resto va en la barra inferior
const HEADER_KEYS = ['settings'];

// Píldora flotante: pestañas a la izquierda, botón + al centro, pestañas a la derecha
export function TabBar({ tab, setTab, onAdd }) {
  const items = TABS.filter((t) => !HEADER_KEYS.includes(t.key));
  const mid = Math.ceil(items.length / 2);
  // Elementos que señala la guía interactiva
  const refs = { moves: useTourRef('tab-moves'), history: useTourRef('tab-history'), savings: useTourRef('tab-savings') };
  const addRef = useTourRef('add');
  const render = (item) => {
    const on = tab === item.key;
    return (
      <View key={item.key} style={s.tabSlot}>
        <Pressable accessibilityRole="button" ref={refs[item.key]} style={[s.tab, on && s.tabOn]} onPress={() => setTab(item.key)} accessibilityLabel={item.label} accessibilityState={{ selected: on }}>
          <Icon name={item.glyph} size={22} color={on ? C.link : C.muted} />
        </Pressable>
      </View>
    );
  };
  return (
    <View style={s.tabbar}>
      <View style={s.tabGroup}>{items.slice(0, mid).map(render)}</View>
      <Pressable accessibilityRole="button" ref={addRef} style={s.tabFab} onPress={onAdd} accessibilityLabel="Nuevo movimiento"><Text style={s.tabFabText}>+</Text></Pressable>
      <View style={s.tabGroup}>{items.slice(mid).map(render)}</View>
    </View>
  );
}