import React from 'react';
import { View, Text } from 'react-native';
import { Card, Title } from '../components/ui';
import { useWide } from '../hooks/useWide';
import { money, shortDate } from '../lib/format';
import { savingsBox } from '../lib/savings';
import { s } from '../theme/styles';

export function SavingsScreen({ moves, settings }) {
  const wide = useWide();
  const info = savingsBox(moves, settings);
  const closings = [...info.closed].reverse();

  const summary = (
    <>
      <Title>Ahorro total</Title>
      <Card>
        <View style={[s.row, s.paceRow, { marginTop: 0 }]}><Text style={s.body}>🐷 Caja de ahorro</Text><Text style={s.body}>{money(info.box)}</Text></View>
        <View style={[s.row, s.sep, s.paceRow, { marginTop: 0 }]}><Text style={s.body}>🎯 En tus metas</Text><Text style={s.body}>{money(info.goalsSaved)}</Text></View>
        <View style={[s.row, s.sep, s.paceRow, { marginTop: 0 }]}><Text style={[s.body, { fontWeight: '600' }]}>Total ahorrado</Text><Text style={[s.body, { fontWeight: '600', color: '#34C759' }]}>{money(info.box + info.goalsSaved)}</Text></View>
      </Card>
    </>
  );

  const history = (
    <>
      <Title>Cierres anteriores</Title>
      <Card>
        {closings.length === 0 && <Text style={[s.hint, { padding: 16 }]}>Cuando termine tu primer ciclo verás aquí cuánto ahorraste.</Text>}
        {closings.map((c, i) => (
          <View key={c.start.getTime()} style={[s.row, i > 0 && s.sep, { justifyContent: 'space-between' }]}>
            <View>
              <Text style={s.body}>{shortDate(c.start)} – {shortDate(c.end)}</Text>
              <Text style={[s.caption, { paddingHorizontal: 0 }]}>Ingresos {money(c.income)} · Gastos {money(c.spent)}</Text>
            </View>
            <Text style={[s.body, { color: c.saved >= 0 ? '#34C759' : '#FF3B30' }]}>{c.saved >= 0 ? '+' : '-'}{money(Math.abs(c.saved))}</Text>
          </View>
        ))}
      </Card>
    </>
  );

  return (
    <>
      <Text style={s.largeTitle}>Caja de ahorro</Text>
      {wide ? (
        <View style={s.cols}><View style={s.col}>{summary}</View><View style={s.col}>{history}</View></View>
      ) : (
        <>{summary}{history}</>
      )}
    </>
  );
}
