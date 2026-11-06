import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Panel } from './ui';
import { C } from '../theme/colors';
import { FONT, s } from '../theme/styles';

const TONE = { good: C.green, ok: C.blue, warn: C.orange, bad: C.red };
const barTone = (x) => (x >= 0.8 ? C.green : x >= 0.5 ? C.orange : C.red);
const barWord = (x) => (x >= 0.8 ? '✓ Bien' : x >= 0.5 ? 'Mejorable' : 'Atención');

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

// Salud financiera del Inicio: calificación con su significado, el consejo principal y, por factor, su estado en palabras
export function HealthCard({ health }) {
  if (!health) return null;
  const color = TONE[health.level.tone];
  return (
    <Panel title="Salud financiera" right={<Text style={s.tileLabel}>Últimos 30 días</Text>}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }} accessible accessibilityLabel={'Salud financiera ' + health.score + ' de 100, ' + health.level.label + '. ' + health.level.text + ' Consejo: ' + health.tip}>
        <ScoreRing score={health.score} color={color} size={84} />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={{ fontFamily: FONT, fontSize: 17, fontWeight: '700', color }}>{health.level.label}</Text>
          <Text style={[s.rowTitle, { fontSize: 14, lineHeight: 19 }]}>{health.level.text}</Text>
        </View>
      </View>
      <View style={{ backgroundColor: C.inset, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
        <Text style={{ fontSize: 14 }}>💡</Text>
        <Text style={[s.smallMuted, { flex: 1, color: C.text, lineHeight: 18 }]}>{health.tip}</Text>
      </View>
      <View style={{ gap: 12 }}>
        {health.factors.map((f) => {
          const tone = barTone(f.score);
          return (
            <View key={f.key} style={{ gap: 2 }} accessible accessibilityLabel={f.label + ', ' + barWord(f.score) + ': ' + f.detail}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ fontFamily: FONT, fontSize: 14, fontWeight: '600', color: C.text, flex: 1 }} numberOfLines={1}>{f.label}</Text>
                <View style={[s.deltaChip, { backgroundColor: tone + '26', paddingVertical: 2 }]}><Text style={[s.deltaText, { color: tone, fontFamily: FONT }]}>{barWord(f.score)}</Text></View>
              </View>
              <Text style={[s.smallMuted, { lineHeight: 18 }]}>{f.detail}</Text>
            </View>
          );
        })}
      </View>
    </Panel>
  );
}
