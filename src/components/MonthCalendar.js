import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { daysIn } from '../lib/dates';
import { isoLocal, monthName } from '../lib/format';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

const WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// Calendario del mes: los días con movimientos se colorean y llevan un punto verde (ingreso) y/o rojo (gasto).
// days: { 'YYYY-MM-DD': { inc, exp } } · selected: 'YYYY-MM-DD' o null
export function MonthCalendar({ month, onMonth, days, selected, onSelect }) {
  const y = month.getFullYear(), m = month.getMonth();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // la semana empieza en lunes
  const total = daysIn(y, m);
  const today = isoLocal(new Date());
  const cells = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  return (
    <View style={s.calWrap}>
      <View style={s.calHeader}>
        <Pressable accessibilityRole="button" onPress={() => onMonth(new Date(y, m - 1, 1))} hitSlop={10}><Text style={s.calArrow}>‹</Text></Pressable>
        <Text style={s.calMonth}>{monthName(month)}</Text>
        <Pressable accessibilityRole="button" onPress={() => onMonth(new Date(y, m + 1, 1))} hitSlop={10}><Text style={s.calArrow}>›</Text></Pressable>
      </View>
      <View style={s.calRow}>
        {WEEK.map((d, i) => <Text key={i} style={s.calWeekday}>{d}</Text>)}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={s.calRow}>
          {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
            if (!d) return <View key={i} style={s.calCell} />;
            const key = isoLocal(new Date(y, m, d));
            const info = days[key], on = selected === key;
            return (
              <Pressable accessibilityRole="button" key={i} style={s.calCell} onPress={() => onSelect(on ? null : key)}>
                <View style={[s.calDay, info && s.calDayHas, key === today && s.calToday, on && s.calDayOn]}>
                  <Text style={[s.calNum, !info && { color: C.muted }, on && { color: C.onPrimary, fontWeight: '700' }]}>{d}</Text>
                  <View style={s.calDots}>
                    {info && info.inc > 0 && <View style={[s.calDot, { backgroundColor: on ? C.onPrimary : C.green }]} />}
                    {info && info.exp > 0 && <View style={[s.calDot, { backgroundColor: on ? C.onPrimary : C.red }]} />}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={s.calLegend}>
        <View style={[s.calDot, { backgroundColor: C.green }]} /><Text style={s.calLegendText}>Ingreso</Text>
        <View style={[s.calDot, { backgroundColor: C.red, marginLeft: 12 }]} /><Text style={s.calLegendText}>Gasto</Text>
      </View>
    </View>
  );
}
