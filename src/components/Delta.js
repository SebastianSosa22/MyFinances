import React from 'react';
import { Text } from 'react-native';
import { s } from '../theme/styles';

export function Delta({ now, prev, upIsGood }) {
  if (!(prev > 0)) return null;
  const pc = Math.round(((now - prev) / prev) * 100);
  if (pc === 0) return <Text style={s.caption}>Igual que el mes anterior</Text>;
  const good = (pc > 0) === upIsGood;
  return <Text style={[s.caption, { color: good ? '#34C759' : '#FF3B30' }]}>{pc > 0 ? '▲' : '▼'} {Math.abs(pc)}% vs mes anterior</Text>;
}
