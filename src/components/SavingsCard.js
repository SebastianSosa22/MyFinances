import React from 'react';
import { View, Text } from 'react-native';
import { Bar, Card } from './ui';
import { CYCLES } from '../constants/budget';
import { money, shortDate } from '../lib/format';
import { s } from '../theme/styles';

// Caja de ahorro (lo acumulado) y disponible del ciclo en curso
export function SavingsCard({ info, cycle }) {
  const { box, available, closing, cur, end, reserved } = info;
  const budget = cur.income - reserved;
  return (
    <Card style={{ padding: 16 }}>
      <View style={s.boxHead}>
        <View>
          <Text style={[s.caption, { paddingHorizontal: 0 }]}>🐷 Caja de ahorro</Text>
          <Text style={[s.big3, { color: box < 0 ? '#FF3B30' : '#34C759' }]}>{money(box)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[s.caption, { paddingHorizontal: 0 }]}>Disponible {CYCLES[cycle].this}</Text>
          <Text style={[s.big3, { color: available < 0 ? '#FF3B30' : '#007AFF' }]}>{money(available)}</Text>
        </View>
      </View>
      {cur.income > 0 ? (
        <>
          <Bar spent={cur.total} budget={budget} color={available < 0 ? '#FF3B30' : '#007AFF'} />
          <Text style={[s.caption, { paddingHorizontal: 0, marginTop: 6 }]}>
            {money(cur.total)} gastados de {money(budget)}{reserved > 0 ? ' (ya apartaste ' + money(reserved) + ')' : ''}
          </Text>
          <Text style={[s.caption, { paddingHorizontal: 0, marginTop: 2 }]}>
            Al cerrar el {shortDate(end)}, {closing >= 0 ? 'se sumarán ' : 'se restarán '}{money(Math.abs(closing))} a tu caja.
          </Text>
        </>
      ) : (
        <Text style={[s.caption, { paddingHorizontal: 0, marginTop: 10 }]}>Registra tu ingreso {CYCLES[cycle].this} para calcular lo que tienes disponible.</Text>
      )}
    </Card>
  );
}
