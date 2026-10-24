import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Amount } from '../components/HomeCards';
import { Icon } from '../components/Icon';
import { MonthNav } from '../components/MonthNav';
import { CATS } from '../constants/budget';
import { daysIn, endOfDay, startOfMonth } from '../lib/dates';
import { report } from '../lib/finance';
import { money } from '../lib/format';
import { limitSuggestions } from '../lib/insights';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

const icon = (cat) => (CATS.find((c) => c.name === cat) || { icon: '🧾' }).icon;
const toneOf = (ratio, timeRatio) => (ratio >= 1 ? C.red : ratio >= 0.8 || ratio > timeRatio + 0.15 ? C.orange : C.green);

// Barra de gasto con una marca que indica cuánto del mes ya pasó (para saber si vas adelantado)
export function TimeBar({ ratio, timeRatio, color }) {
  return (
    <View style={{ justifyContent: 'center', marginTop: 14 }}>
      <View style={[s.barBg, { height: 10, borderRadius: 5 }]}>
        <View style={{ width: Math.min(ratio, 1) * 100 + '%', height: 10, borderRadius: 5, backgroundColor: color }} />
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
  const daysLeft = isCurrent ? total - now.getDate() : 0;
  const rows = Object.entries(limits).map(([cat, lim]) => ({ cat, lim, spent: byCat[cat] || 0 }));
  const sorters = { attention: (a, b) => b.spent / b.lim - a.spent / a.lim, name: (a, b) => a.cat.localeCompare(b.cat), amount: (a, b) => b.lim - a.lim };
  rows.sort(sorters[sort]);
  const limTotal = rows.reduce((a, r) => a + r.lim, 0), spentTotal = rows.reduce((a, r) => a + r.spent, 0);
  const left = limTotal - spentTotal;
  const nextSort = () => { const keys = Object.keys(SORTS); setSort(keys[(keys.indexOf(sort) + 1) % keys.length]); };

  return (
    <>
      {rows.length > 0 && (
        <MonthNav month={month} onMonth={setMonth} min={oldest} max={startOfMonth(now)} sub="llevas">
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 14, gap: 10 }}>
            <Amount value={spentTotal} size={40} />
            <Text style={s.monthSub}>de {money(limTotal, true)}</Text>
          </View>
          <TimeBar ratio={limTotal > 0 ? spentTotal / limTotal : 0} timeRatio={timeRatio} color={toneOf(spentTotal / limTotal, timeRatio)} />
          <Text style={[s.balanceSub, { fontSize: 15, marginTop: 12 }]}>
            {left >= 0 ? 'Te quedan ' + money(left, true) : 'Te pasaste ' + money(-left, true)} · {rows.length} {rows.length === 1 ? 'categoría con presupuesto' : 'categorías con presupuesto'}
            {isCurrent ? ' · faltan ' + daysLeft + (daysLeft === 1 ? ' día' : ' días') : ''}
          </Text>
        </MonthNav>
      )}

      {isCurrent && suggestions.length > 0 && (
        <View style={[s.card, { padding: 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={s.bulb}><Text style={{ fontSize: 26 }}>💡</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.miniTitle}>Sugerencias de presupuesto</Text>
              <Text style={s.miniText}>{basis}</Text>
            </View>
          </View>
          {suggestions.slice(0, 6).map((x) => (
            <View key={x.cat} style={s.suggestRow}>
              <Text style={{ fontSize: 26, marginRight: 12 }}>{icon(x.cat)}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.body, { fontWeight: '600' }]} numberOfLines={1}>{x.cat}</Text>
                <Text style={s.miniText}>{sugg.months === 0 ? 'Llevas ' + money(Math.round(x.avg)) + ' este mes' : 'Gastas en promedio ' + money(Math.round(x.avg)) + '/mes'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                <Text style={[s.body, { fontWeight: '700', color: C.green }]}>{money(x.amount)}</Text>
                <Text style={s.miniText}>/mes</Text>
              </View>
              <Pressable style={s.plusBtn} onPress={() => onSaveLimit(x.cat, x.amount)} accessibilityLabel={'Crear presupuesto de ' + x.cat}><Text style={s.plusText}>+</Text></Pressable>
            </View>
          ))}
          {suggestions.length > 1 && (
            <Pressable style={[s.btnPrimary, { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 14 }]} onPress={() => onApplyLimits(Object.fromEntries(suggestions.slice(0, 6).map((x) => [x.cat, x.amount])))}>
              <Text style={s.btnText}>✓ Crear los {Math.min(suggestions.length, 6)} presupuestos</Text>
            </Pressable>
          )}
          <Pressable onPress={() => onEdit(null)} style={{ marginTop: 14 }}><Text style={[s.link, { textAlign: 'center', textDecorationLine: 'underline', fontSize: 15 }]}>O crear presupuesto personalizado</Text></Pressable>
        </View>
      )}

      <View style={[s.balanceHead, { marginTop: 22, marginBottom: 4, paddingHorizontal: 4 }]}>
        {rows.length > 1 ? <Pressable onPress={nextSort} hitSlop={8}><Text style={[s.body, { color: C.muted }]}>⇅ {SORTS[sort]}</Text></Pressable> : <View />}
        <Pressable onPress={() => onEdit(null)} hitSlop={8}><Text style={[s.link, { fontWeight: '600' }]}>+ Crear presupuesto</Text></Pressable>
      </View>

      {rows.length === 0 && (
        <View style={[s.card, s.dashed]}>
          <Text style={{ fontSize: 30, marginRight: 14 }}>🧺</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.miniTitle}>Ponle tope a lo que más gastas</Text>
            <Text style={s.miniText}>Crea un presupuesto mensual por categoría y ve cuánto te queda.</Text>
          </View>
        </View>
      )}
      {rows.map((r) => {
        const ratio = r.spent / r.lim, color = toneOf(ratio, timeRatio), rem = r.lim - r.spent;
        return (
          <Pressable key={r.cat} style={[s.card, { padding: 16 }]} onPress={() => onEdit({ cat: r.cat, amount: r.lim })}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={s.iconBox}><Text style={{ fontSize: 22 }}>{icon(r.cat)}</Text></View>
              <Text style={[s.body, { flex: 1 }]} numberOfLines={1}>{r.cat}</Text>
              <Text style={[s.balanceLabel, { marginRight: 6 }]}>{rem >= 0 ? 'te quedan' : 'te pasaste'}</Text>
              <Amount value={Math.abs(rem)} size={18} color={rem >= 0 ? C.text : C.red} />
              <View style={{ marginLeft: 6 }}><Icon name="chevron" size={18} color={C.muted} /></View>
            </View>
            <View style={{ paddingLeft: 54 }}>
              <TimeBar ratio={ratio} timeRatio={timeRatio} color={color} />
              <Text style={[s.balanceSub, { marginTop: 8 }]}>{money(r.spent, true)} de {money(r.lim, true)}</Text>
            </View>
          </Pressable>
        );
      })}
    </>
  );
}
