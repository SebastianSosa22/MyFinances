import React from 'react';
import { View, Text } from 'react-native';
import { Card } from './ui';
import { BUCKETS, CYCLES } from '../constants/budget';
import { money, shortDate } from '../lib/format';
import { s } from '../theme/styles';

// Caja de ahorro: lo acumulado y lo que se sumará al cerrar el ciclo.
// El "cuánto puedo gastar" vive solo en la tarjeta principal del Resumen, para no mostrar dos cifras de disponible.
export function SavingsCard({ info, cycle }) {
  const { box, closing, cur, end, reserved } = info;
  return (
    <Card style={{ padding: 16 }}>
      <View style={s.boxHead}>
        <View>
          <Text style={[s.caption, { paddingHorizontal: 0 }]}>🐷 Caja de ahorro</Text>
          <Text style={[s.big3, { color: box < 0 ? '#F87171' : '#4ADE80' }]}>{money(box)}</Text>
        </View>
        {cur.income > 0 && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.caption, { paddingHorizontal: 0 }]}>Al cerrar el {shortDate(end)}</Text>
            <Text style={[s.body, { fontWeight: '600', marginTop: 6, color: closing < 0 ? '#F87171' : '#9AA3B2' }]}>{closing < 0 ? '−' : '+'}{money(Math.abs(closing))}</Text>
          </View>
        )}
      </View>
      {cur.income > 0 ? (
        <Text style={[s.caption, { paddingHorizontal: 0, marginTop: 10 }]}>
          {closing >= 0
            ? 'Si no gastas más, al cerrar ' + CYCLES[cycle].this + ' pasarán ' + money(closing) + ' a tu caja (incluye tu ' + BUCKETS.savings.pct + '% de ahorro).'
            : 'Este ciclo gastaste más de lo que ingresó: al cerrar se restarán ' + money(-closing) + ' de tu caja.'}
          {reserved > 0 ? ' Ya apartaste ' + money(reserved) + ' al recibir tu ingreso.' : ''}
        </Text>
      ) : (
        <Text style={[s.caption, { paddingHorizontal: 0, marginTop: 10 }]}>Registra tu ingreso {CYCLES[cycle].this} para ver cuánto pasará a tu caja.</Text>
      )}
    </Card>
  );
}
