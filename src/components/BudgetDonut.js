import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { BUCKETS } from '../constants/budget';

// Dona única: cada tramo es una parte del plan 50/30/20 y se llena conforme gastas (rojo si te pasas)
export function BudgetDonut({ spent, income, center, size = 200 }) {
  const sw = 24, r = size / 2 - sw / 2 - 2, C = 2 * Math.PI * r, gap = 6;
  let acc = 0;
  return (
    <View style={{ width: size, height: size, alignSelf: 'center', marginTop: 16 }}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          {Object.keys(BUCKETS).map((k) => {
            const seg = (BUCKETS[k].pct / 100) * C, len = seg - gap, start = acc;
            acc += seg;
            const target = (income * BUCKETS[k].pct) / 100;
            const fill = target > 0 ? Math.min(spent[k] / target, 1) * len : 0;
            const col = target > 0 && spent[k] > target ? '#FF3B30' : BUCKETS[k].color;
            const common = { cx: size / 2, cy: size / 2, r, strokeWidth: sw, fill: 'none', strokeDashoffset: -start };
            return (
              <G key={k}>
                <Circle {...common} stroke={BUCKETS[k].color} strokeOpacity={0.2} strokeDasharray={`${len} ${C - len}`} />
                {fill > 0 && <Circle {...common} stroke={col} strokeDasharray={`${fill} ${C - fill}`} />}
              </G>
            );
          })}
        </G>
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>{center}</View>
    </View>
  );
}
