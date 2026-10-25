import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { MonthSwitch } from '../components/ui';
import { BUCKETS, CATS } from '../constants/budget';
import { daysIn, endOfDay, startOfMonth } from '../lib/dates';
import { bucketOf, report } from '../lib/finance';
import { money } from '../lib/format';
import { limitSuggestions } from '../lib/insights';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

const icon = (cat) => (CATS.find((c) => c.name === cat) || { icon: '🧾' }).icon;

// Barra de gasto con una marca que indica cuánto del mes ya pasó (para saber si vas adelantado)
export function TimeBar({ ratio, timeRatio, color }) {
  return (
    <View style={{ justifyContent: 'center' }}>
      <View style={[s.barBg, { height: 8, borderRadius: 4 }]}>
        <View style={{ width: Math.min(ratio, 1) * 100 + '%', height: 8, borderRadius: 4, backgroundColor: color }} />
      </View>
      {timeRatio > 0 && timeRatio < 1 && <View style={[s.timeMark, { left: timeRatio * 100 + '%' }]} />}
    </View>
  );
}

const SORTS = { attention: 'Por atención', name: 'Por nombre', amount: 'Por monto' };

// Presupuestos: un límite mensual por categoría, cuánto llevas este mes y sugerencias según tu historial
export function BudgetsScreen({ moves, limits, onSaveLimit, onApplyLimits, onEdit }) {
  const now = new Date();
  const [month, setMonth] = useState(() => startOfMonth(now));
  const [sort, setSort] = useState('attention');
  const first = moves.reduce((a, m) => Math.min(a, new Date(m.occurred_at).getTime()), Infinity);
  const oldest = startOfMonth(Number.isFinite(first) && first < now.getTime() ? new Date(first) : now);
  const isCurrent = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
  const last = endOfDay(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const byCat = report(moves, month, isCurrent ? now : last).byCat;
  const sugg = useMemo(() => limitSuggestions(moves), [moves]);
  const suggestions = sugg.items.filter((x) => !limits[x.cat]);
  const basis = sugg.months === 0 ? 'Basado en lo que llevas gastado este mes' : sugg.months === 1 ? 'Basado en tus gastos del mes pasado' : 'Basado en tus gastos de los últimos ' + sugg.months + ' meses';

  const total = daysIn(month.getFullYear(), month.getMonth());
  const timeRatio = isCurrent ? now.getDate() / total : 1;
  const rows = Object.entries(limits).map(([cat, lim]) => ({ cat, lim, spent: byCat[cat] || 0 }));
  const sorters = { attention: (a, b) => b.spent / b.lim - a.spent / a.lim, name: (a, b) => a.cat.localeCompare(b.cat), amount: (a, b) => b.lim - a.lim };
  rows.sort(sorters[sort]);
  const limTotal = rows.reduce((a, r) => a + r.lim, 0), spentTotal = rows.reduce((a, r) => a + r.spent, 0);
  const nextSort = () => { const keys = Object.keys(SORTS); setSort(keys[(keys.indexOf(sort) + 1) % keys.length]); };

  const monthName = month.toLocaleDateString('es-MX', { month: 'long' });
  return (
    <>
      <View style={[s.panelHead, { alignItems: 'center', marginTop: 14 }]}>
        <MonthSwitch month={month} onMonth={setMonth} min={oldest} max={startOfMonth(now)} />
        {rows.length > 1 && <Pressable accessibilityRole="button" onPress={nextSort} hitSlop={8} style={s.sortPill}><Text style={s.catChipText}>{SORTS[sort]} ▾</Text></Pressable>}
      </View>
      <Text style={[s.smallMuted, { marginTop: 10, paddingHorizontal: 2 }]}>
        {monthName.charAt(0).toUpperCase() + monthName.slice(1)}{isCurrent ? ' · día ' + now.getDate() + ' de ' + total : ''}
        {rows.length > 0 ? ' · llevas ' : ''}{rows.length > 0 && <Text style={[s.rowAmount, { fontSize: 13 }]}>{money(Math.round(spentTotal))}</Text>}{rows.length > 0 ? ' de ' + money(Math.round(limTotal)) : ''}
      </Text>

      {rows.length === 0 && (
        <View style={[s.dashedCard, { marginTop: 14 }]}>
          <Text style={s.panelTitle}>Ponle tope a lo que más gastas</Text>
          <Text style={s.smallMuted}>Crea un presupuesto mensual por categoría y ve cuánto te queda.</Text>
        </View>
      )}
      {rows.map((r) => {
        const ratio = r.spent / r.lim, rem = r.lim - r.spent, over = rem < 0;
        const dot = (BUCKETS[bucketOf(r.cat)] || BUCKETS.wants).color;
        const note = over ? 'Te pasaste ' + money(Math.round(-rem)) : 'Te quedan ' + money(Math.round(rem)) + (isCurrent && ratio <= timeRatio ? ' · vas a buen ritmo' : '');
        return (
          <Pressable accessibilityRole="button" key={r.cat} style={[s.panel, { borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16, gap: 10, marginTop: 12 }]} onPress={() => onEdit({ cat: r.cat, amount: r.lim })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[s.catDot, { width: 10, height: 10, borderRadius: 5, backgroundColor: dot }]} />
              <Text style={[s.rowTitle, { flex: 1, fontWeight: '600' }]} numberOfLines={1}>{icon(r.cat)} {r.cat}</Text>
              <Text style={[s.rowAmount, { fontSize: 14 }]}>{money(Math.round(r.spent))}<Text style={{ color: C.muted }}> / {money(Math.round(r.lim)).slice(1)}</Text></Text>
            </View>
            <TimeBar ratio={ratio} timeRatio={isCurrent ? timeRatio : 0} color={over ? '#FF7A7A' : dot} />
            <Text style={[s.smallMuted, over && { color: C.red }]}>{note}</Text>
          </Pressable>
        );
      })}

      {isCurrent && suggestions.length > 0 && (
        <View style={[s.dashedCard, { marginTop: 12 }]}>
          <Text style={s.panelTitle}>💡 Sugerencias de presupuesto</Text>
          <Text style={s.smallMuted}>Ponle tope a lo que más gastas. {basis}.</Text>
          {suggestions.slice(0, 6).map((x) => (
            <Pressable accessibilityRole="button" key={x.cat} style={s.ghostBtn} onPress={() => onSaveLimit(x.cat, x.amount)} accessibilityLabel={'Crear presupuesto de ' + x.cat}>
              <Text style={[s.linkSm, { fontSize: 14, fontWeight: '600' }]} numberOfLines={1}>{icon(x.cat)} {x.cat}: crear presupuesto de {money(x.amount)}</Text>
              <Text style={s.rowSub}>{sugg.months === 0 ? 'Llevas ' + money(Math.round(x.avg)) + ' este mes' : 'Gastas en promedio ' + money(Math.round(x.avg)) + '/mes'}</Text>
            </Pressable>
          ))}
          {suggestions.length > 1 && (
            <Pressable accessibilityRole="button" style={[s.button, { marginTop: 4 }]} onPress={() => onApplyLimits(Object.fromEntries(suggestions.slice(0, 6).map((x) => [x.cat, x.amount])))}>
              <Text style={s.buttonText}>✓ Crear los {Math.min(suggestions.length, 6)} presupuestos</Text>
            </Pressable>
          )}
        </View>
      )}

      <Pressable accessibilityRole="button" style={s.outlineBtn} onPress={() => onEdit(null)}><Text style={[s.panelTitle, { fontSize: 15 }]}>+ Crear presupuesto</Text></Pressable>
    </>
  );
}
