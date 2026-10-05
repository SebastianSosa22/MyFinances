import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { s } from '../theme/styles';

export function Donut({ values, size = 140, label, center }) {
  const r = size / 2 - 14, C = 2 * Math.PI * r, total = values.reduce((a, v) => a + v.value, 0);
  let acc = 0;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="#E5E5EA" strokeWidth={20} fill="none" />
          <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
            {total > 0 && values.map((v) => {
              const len = (v.value / total) * C;
              const el = <Circle key={v.color} cx={size / 2} cy={size / 2} r={r} stroke={v.color} strokeWidth={20} fill="none"
                strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />;
              acc += len; return el;
            })}
          </G>
        </Svg>
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={s.donutCenter}>{center}</Text>
        </View>
      </View>
      <Text style={s.caption}>{label}</Text>
    </View>
  );
}
