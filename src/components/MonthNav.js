import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Icon } from './Icon';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

export const MONTH = (d) => { const x = d.toLocaleDateString('es-MX', { month: 'long' }); return x.charAt(0).toUpperCase() + x.slice(1); };

// Tarjeta con el nombre del mes y flechas para ir al mes anterior o siguiente.
// `sub` va junto al mes ("· has gastado") y `children` debajo (el monto, la barra...).
export function MonthNav({ month, onMonth, min, max, sub, children }) {
  const prev = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const canPrev = !min || prev >= min, canNext = !max || next <= max;
  const year = month.getFullYear() !== new Date().getFullYear() ? ' ' + month.getFullYear() : '';
  return (
    <View style={[s.card, s.monthCard]}>
      <View style={s.monthHead}>
        <Text style={s.monthTitle} numberOfLines={1}>{MONTH(month)}{year}{!!sub && <Text style={s.monthSub}> · {sub}</Text>}</Text>
        <View style={s.headerRight}>
          <Pressable accessibilityRole="button" style={[s.navBtn, !canPrev && { opacity: 0.35 }]} disabled={!canPrev} onPress={() => onMonth(prev)} accessibilityLabel="Mes anterior"><Icon name="chevronLeft" size={20} color={C.text} /></Pressable>
          <Pressable accessibilityRole="button" style={[s.navBtn, !canNext && { opacity: 0.35 }]} disabled={!canNext} onPress={() => onMonth(next)} accessibilityLabel="Mes siguiente"><Icon name="chevron" size={20} color={C.text} /></Pressable>
        </View>
      </View>
      {children}
    </View>
  );
}
