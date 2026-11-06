import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Panel } from './ui';
import { C } from '../theme/colors';
import { FONT, s } from '../theme/styles';

const TONE = { good: C.green, ok: C.blue, warn: C.orange, bad: C.red };
const barTone = (x) => (x >= 0.8 ? C.green : x >= 0.5 ? C.orange : C.red);
const barWord = (x) => (x >= 0.8 ? 'Bien' : x >= 0.5 ? 'Mejorable' : 'Atención');

// Anillo con la calificación de 0 a 100
function ScoreRing({ score, color, size = 104 }) {
  const sw = Math.round(size / 11), r = size / 2 - sw / 2 - 1, len = 2 * Math.PI * r, fill = (Math.max(score, 0) / 100) * len;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.raised} strokeWidth={sw} fill="none" />
          {fill > 0 && <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round" strokeDasharray={`${fill} ${len - fill}`} />}
        </G>
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={[s.amount, { fontSize: Math.round(size * 0.27), color: C.text }]}>{score}</Text>
        <Text style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>de 100</Text>
      </View>
    </View>
  );
}

// Salud financiera del Inicio: calificación, nivel y consejo arriba; abajo una línea por factor (punto de color + dato)
export function HealthCard({ health }) {
  if (!health) return null;
  const color = TONE[health.level.tone];
  return (
    <Panel title="Salud financiera" right={
      <View style={[s.deltaChip, { backgroundColor: color + '26' }]}><Text style={[s.deltaText, { color }]}>{health.level.label}</Text></View>
    }>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }} accessible accessibilityLabel={'Salud financiera ' + health.score + ' de 100, ' + health.level.label + '. ' + health.tip}>
        <ScoreRing score={health.score} color={color} size={84} />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={[s.rowTitle, { fontSize: 14, lineHeight: 20 }]}>{health.tip}</Text>
          <Text style={[s.tileLabel, { fontSize: 11 }]}>Con tus últimos 30 días, en tu teléfono</Text>
        </View>
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: C.cardBorder, paddingTop: 10, gap: 8 }}>
        {health.factors.map((f) => (
          <View key={f.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessible accessibilityLabel={f.label + ': ' + f.detail + ', ' + barWord(f.score)}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: barTone(f.score) }} />
            <Text style={[s.smallMuted, { flex: 1, color: C.text }]} numberOfLines={1}>{f.label}</Text>
            <Text style={[s.smallMuted, { color: barTone(f.score), fontWeight: '600' }]} numberOfLines={1}>{f.detail}</Text>
          </View>
        ))}
      </View>
    </Panel>
  );
}
