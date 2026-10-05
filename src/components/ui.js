import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useWide } from '../hooks/useWide';
import { s } from '../theme/styles';

export const Card = ({ children, style }) => <View style={[s.card, style]}>{children}</View>;

export const Title = ({ children }) => <Text style={s.sectionTitle}>{children}</Text>;

export function Segmented({ options, value, onChange }) {
  const wide = useWide();
  return (
    <View style={[s.seg, wide && { maxWidth: 420 }]}>
      {Object.entries(options).map(([k, v]) => (
        <Pressable key={k} onPress={() => onChange(k)} style={[s.segItem, value === k && s.segActive]}>
          <Text style={[s.segText, value === k && { fontWeight: '600' }]}>{v.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Bar({ spent, budget, color }) {
  const over = spent > budget, w = budget > 0 ? Math.min(spent / budget, 1) * 100 : 0;
  return (
    <View style={s.barBg}><View style={{ width: `${w}%`, height: 8, borderRadius: 4, backgroundColor: over ? '#FF3B30' : color }} /></View>
  );
}
