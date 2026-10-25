import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useWide } from '../hooks/useWide';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

export const Card = ({ children, style }) => <View style={[s.card, style]}>{children}</View>;

export const Title = ({ children }) => <Text style={s.sectionTitle}>{children}</Text>;

export function Segmented({ options, value, onChange, style }) {
  const wide = useWide();
  return (
    <View style={[s.seg, wide && { maxWidth: 420 }, style]}>
      {Object.entries(options).map(([k, v]) => (
        <Pressable accessibilityRole="button" accessibilityState={{ selected: value === k }} key={k} onPress={() => onChange(k)} style={[s.segItem, value === k && s.segActive]}>
          <Text style={[s.segText, value === k && { fontWeight: '600' }]}>{v.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Bar({ spent, budget, color }) {
  const over = spent > budget, w = budget > 0 ? Math.min(spent / budget, 1) * 100 : 0;
  return (
    <View style={s.barBg}><View style={{ width: `${w}%`, height: 6, borderRadius: 3, backgroundColor: over ? C.red : color }} /></View>
  );
}

// Tarjeta del diseño "Bóveda nocturna": título opcional a la izquierda y un enlace o dato a la derecha
export function Panel({ title, right, onRight, children, style }) {
  return (
    <View style={[s.panel, style]}>
      {(!!title || !!right) && (
        <View style={s.panelHead}>
          {!!title && <Text style={s.panelTitle}>{title}</Text>}
          {typeof right === 'string' ? <Pressable accessibilityRole="button" onPress={onRight} hitSlop={8}><Text style={s.linkSm}>{right}</Text></Pressable> : right}
        </View>
      )}
      {children}
    </View>
  );
}

// Recuadro hundido con una etiqueta y una cifra
export const Tile = ({ label, value, color, onPress, small }) => {
  const body = (<><Text style={s.tileLabel} numberOfLines={1}>{label}</Text><Text style={[s.tileValue, small && { fontSize: 14, letterSpacing: -0.4 }, color && { color }]} numberOfLines={1}>{value}</Text></>);
  return onPress ? <Pressable accessibilityRole="button" style={s.tile} onPress={onPress}>{body}</Pressable> : <View style={s.tile}>{body}</View>;
};

// Etiqueta con el cambio en % (verde si es bueno, roja si no)
export function DeltaChip({ now, prev, upIsGood, label }) {
  if (!(prev > 0)) return null;
  const pc = Math.round(((now - prev) / prev) * 100);
  const good = pc === 0 || (pc > 0) === upIsGood;
  return (
    <View style={s.deltaRow}>
      <View style={[s.deltaChip, { backgroundColor: good ? C.greenSoft : '#3A1F26' }]}>
        <Text style={[s.deltaText, { color: good ? C.green : C.red }]}>{pc === 0 ? '= 0%' : (pc > 0 ? '▲ ' : '▼ ') + Math.abs(pc) + '%'}</Text>
      </View>
      {!!label && <Text style={s.smallMuted}>{label}</Text>}
    </View>
  );
}

// Selector de mes compacto: ‹ Octubre ›  (min/max: primer y último mes permitidos)
export function MonthSwitch({ month, onMonth, min, max }) {
  const prev = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const canPrev = !min || prev >= min, canNext = !max || next <= max;
  const name = month.toLocaleDateString('es-MX', { month: 'long' });
  const year = month.getFullYear() !== new Date().getFullYear() ? ' ' + month.getFullYear() : '';
  return (
    <View style={s.monthSwitch}>
      <Pressable accessibilityRole="button" style={[s.monthArrow, !canPrev && { opacity: 0.3 }]} disabled={!canPrev} onPress={() => onMonth(prev)} accessibilityLabel="Mes anterior"><Text style={[s.monthLabel, { color: C.muted, fontSize: 18 }]}>‹</Text></Pressable>
      <Text style={s.monthLabel}>{name}{year}</Text>
      <Pressable accessibilityRole="button" style={[s.monthArrow, !canNext && { opacity: 0.3 }]} disabled={!canNext} onPress={() => onMonth(next)} accessibilityLabel="Mes siguiente"><Text style={[s.monthLabel, { color: C.muted, fontSize: 18 }]}>›</Text></Pressable>
    </View>
  );
}

// Encabezado de pantalla: título grande y, a la derecha, un control (selector de mes, botón...)
export const ScreenHeader = ({ title, right }) => (
  <View style={s.screenHead}><Text style={s.screenTitle}>{title}</Text>{right}</View>
);
