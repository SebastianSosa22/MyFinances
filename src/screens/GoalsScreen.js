import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SwipeRow } from '../components/SwipeRow';
import { Bar, Card } from '../components/ui';
import { useWide } from '../hooks/useWide';
import { money, monthName } from '../lib/format';
import { monthlyNeedsAverage } from '../lib/summary';
import { s } from '../theme/styles';

export function GoalsScreen({ goals, moves, onEdit, onDelete, onContribute, onSave }) {
  const wide = useWide();
  const needsAvg = monthlyNeedsAverage(moves);
  const createEmergency = () => onSave({ name: 'Fondo de emergencia', target: Math.round(needsAvg * 3), deadline: null }, null);
  const now = new Date();
  const hasEmergency = goals.some((g) => /emergencia/i.test(g.name));
  return (
    <View style={wide ? { maxWidth: 760 } : null}>
      <Text style={s.largeTitle}>Metas</Text>
      {goals.length === 0 && <Text style={s.hint}>Aún no tienes metas. Toca + para crear la primera.</Text>}
      {!hasEmergency && needsAvg > 0 && (
        <Card style={{ padding: 16 }}>
          <Text style={s.body}>🛟 Fondo de emergencia</Text>
          <Text style={[s.caption, { paddingHorizontal: 0, marginTop: 4 }]}>Meta sugerida: 3 meses de tus gastos en Necesidades, unos {money(needsAvg * 3)}.</Text>
          <Pressable style={s.button} onPress={createEmergency}><Text style={s.buttonText}>Crear esta meta</Text></Pressable>
        </Card>
      )}
      {goals.length > 0 && (
        <Card>
          {goals.map((g, i) => {
            const mine = moves.filter((m) => m.goal_id === g.id);
            const saved = mine.reduce((a, m) => a + m.amount, 0);
            const rem = Math.max(g.target - saved, 0), done = saved >= g.target;
            const firstT = mine.reduce((a, m) => Math.min(a, new Date(m.occurred_at).getTime()), now.getTime());
            const pace = saved / Math.max((now.getTime() - firstT) / (30.4 * 864e5), 1);
            const parts = [];
            if (done) parts.push('¡Meta lograda! 🎉');
            else {
              if (g.deadline) {
                const dl = new Date(g.deadline + 'T12:00:00');
                if (dl < now) parts.push('La fecha de esta meta ya pasó');
                else parts.push('Para el ' + dl.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ahorra ' + money(rem / Math.max(Math.ceil((dl - now) / (30.4 * 864e5)), 1)) + ' al mes');
              }
              if (pace > 0) parts.push('A tu ritmo la alcanzas en ' + monthName(new Date(now.getTime() + (rem / pace) * 30.4 * 864e5)));
            }
            return (
              <SwipeRow key={g.id} first={i === 0} onDelete={() => onDelete(g.id)}>
                <Pressable style={{ padding: 16 }} onPress={() => onEdit(g)}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={[s.body, { fontWeight: '600', flex: 1 }]}>{g.name}</Text>
                    <Text style={s.body}>{Math.min(Math.round((saved / g.target) * 100), 100)}%</Text>
                  </View>
                  <Bar spent={Math.min(saved, g.target)} budget={g.target} color="#34C759" />
                  <Text style={[s.caption, { paddingHorizontal: 0, marginTop: 6 }]}>{money(saved)} de {money(g.target)}{!done ? ' · faltan ' + money(rem) : ''}</Text>
                  {parts.length > 0 && <Text style={[s.caption, { paddingHorizontal: 0, marginTop: 2 }]}>{parts.join('\n')}</Text>}
                  {!done && <Pressable onPress={() => onContribute(g)} style={{ alignSelf: 'flex-start', marginTop: 10 }} hitSlop={8}><Text style={s.link}>+ Aportar</Text></Pressable>}
                </Pressable>
              </SwipeRow>
            );
          })}
        </Card>
      )}
      {goals.length > 0 && <Text style={s.hint}>Cada aporte cuenta como gasto de Ahorro. Toca una meta para editarla o desliza para borrarla.</Text>}
    </View>
  );
}
