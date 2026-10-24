import React from 'react';
import { View, Text } from 'react-native';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

// Piezas del panel de administrador: tarjetas de número, columnas por día/hora y barras horizontales

export const TONE = { good: C.green, warn: C.orange, bad: C.red, info: '#5B9BFF' };

export function StatTile({ label, value, sub, tone }) {
  return (
    <View style={s.statTile}>
      <Text style={s.statLabel} numberOfLines={1}>{label}</Text>
      <Text style={[s.statValue, tone && { color: TONE[tone] }]} numberOfLines={1}>{value}</Text>
      {!!sub && <Text style={s.statSub} numberOfLines={1}>{sub}</Text>}
    </View>
  );
}

export function TileGrid({ children }) {
  return <View style={s.tileGrid}>{children}</View>;
}

// Columnas verticales. data: [{ label, value }]. Muestra como máximo ~8 etiquetas en el eje.
export function Columns({ data, color = C.primary, height = 120, format = String }) {
  const max = Math.max(1, ...data.map((x) => x.value));
  const every = Math.max(1, Math.ceil(data.length / 8));
  const peak = data.reduce((best, x) => (x.value > best.value ? x : best), { value: -1 });
  return (
    <View style={{ padding: 16, paddingTop: 8 }}>
      <View style={[s.colsChart, { height }]}>
        {data.map((x, i) => (
          <View key={i} style={s.colSlot}>
            <View style={[s.colBar, { height: Math.max(2, (x.value / max) * height), backgroundColor: x.value ? color : C.raised }]} />
          </View>
        ))}
      </View>
      <View style={s.colAxis}>
        {data.map((x, i) => (
          <Text key={i} style={s.colLabel} numberOfLines={1}>{i % every === 0 ? x.label : ''}</Text>
        ))}
      </View>
      {peak.value > 0 && <Text style={[s.statSub, { marginTop: 6 }]}>Máximo: {format(peak.value)} ({peak.label})</Text>}
    </View>
  );
}

// Barras horizontales. rows: [{ label, value, sub }]. `suffix` se agrega al número (por ejemplo '%').
export function HBars({ rows, color = C.primary, max, suffix = '', empty = 'Sin datos todavía' }) {
  if (!rows.length) return <Text style={[s.hint, { marginBottom: 16 }]}>{empty}</Text>;
  const top = max || Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
      {rows.map((r, i) => (
        <View key={r.label + i} style={{ marginTop: 10 }}>
          <View style={s.hbarHead}>
            <Text style={s.hbarLabel} numberOfLines={1}>{r.label}</Text>
            <Text style={s.hbarValue}>{r.value}{suffix}{r.sub ? <Text style={s.statSub}>{'  ' + r.sub}</Text> : null}</Text>
          </View>
          <View style={s.barBg}>
            <View style={{ width: `${Math.min(100, (r.value / top) * 100)}%`, height: 8, borderRadius: 4, backgroundColor: r.color || color }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function Pill({ text, tone = 'info' }) {
  return (
    <View style={[s.pill, { backgroundColor: TONE[tone] + '26' }]}>
      <Text style={[s.pillText, { color: TONE[tone] }]}>{text}</Text>
    </View>
  );
}

export function CardHead({ title, sub }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
      <Text style={s.cardHeadTitle}>{title}</Text>
      {!!sub && <Text style={[s.statSub, { marginTop: 2 }]}>{sub}</Text>}
    </View>
  );
}
