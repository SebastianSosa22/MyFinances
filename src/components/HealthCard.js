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
  const sw = 10, r = size / 2 - sw / 2 - 1, len = 2 * Math.PI * r, fill = (Math.max(score, 0) / 100) * len;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.raised} strokeWidth={sw} fill="none" />
          {fill > 0 && <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round" strokeDasharray={`${fill} ${len - fill}`} />}
        </G>
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={[s.amount, { fontSize: 28, color: C.text }]}>{score}</Text>
        <Text style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>de 100</Text>
      </View>
    </View>
  );
}

// Salud financiera del Inicio: calificación, nivel, el consejo que más te ayudaría y cómo va cada factor
export function HealthCard({ health }) {
  if (!health) return null;
  const color = TONE[health.level.tone];
  return (
    <Panel title="Salud financiera" right={
      <View style={[s.deltaChip, { backgroundColor: color + '26' }]}><Text style={[s.deltaText, { color }]}>{health.level.label}</Text></View>
    }>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }} accessible accessibilityLabel={'Salud financiera ' + health.score + ' de 100, ' + health.level.label}>
        <ScoreRing score={health.score} color={color} />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={s.eyebrow}>Lo que más te ayudaría</Text>
          <Text style={[s.rowTitle, { fontSize: 14, lineHeight: 20 }]}>{health.tip}</Text>
        </View>
      </View>
      <View style={{ gap: 10 }}>
        {health.factors.map((f) => (
          <View key={f.key} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ fontFamily: FONT, fontSize: 13, fontWeight: '600', color: C.text }} numberOfLines={1}>{f.label}</Text>
              <Text style={[s.tileLabel, { color: barTone(f.score) }]}>{barWord(f.score)}</Text>
            </View>
            <View style={s.barBg}><View style={{ width: `${Math.round(f.score * 100)}%`, height: 6, borderRadius: 3, backgroundColor: barTone(f.score) }} /></View>
            <Text style={s.tileLabel} numberOfLines={2}>{f.detail}</Text>
          </View>
        ))}
      </View>
      <Text style={[s.smallMuted, { fontSize: 12 }]}>Calculada con tus últimos 30 días, en tu teléfono.</Text>
    </Panel>
  );
}
