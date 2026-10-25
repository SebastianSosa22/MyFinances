import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { BudgetDonut } from './BudgetDonut';
import { Icon } from './Icon';
import { DeltaChip, Panel, Tile } from './ui';
import { BUCKETS } from '../constants/budget';
import { money, shortDate } from '../lib/format';
import { C } from '../theme/colors';
import { FONT, MONO, s } from '../theme/styles';

export const HIDDEN = '$•••';

// Monto con los centavos más chicos y tenues: $2,500.00.
// Con `fit`, mide el espacio disponible y reduce la letra si el monto no cabe (adjustsFontSizeToFit no existe en la web).
// Solo sirve donde el contenedor tiene un ancho propio (una columna con flex), no en una fila que se ajusta al texto.
const CHAR_W = 0.62; // ancho aproximado de un dígito, en proporción al tamaño de letra
export function Amount({ value, size = 28, color = C.text, hide, center, fit, plus }) {
  const [width, setWidth] = useState(0);
  const [int, cents] = hide ? [HIDDEN, ''] : money(value, true).split('.');
  const need = (int.length + (cents ? 0.55 * (cents.length + 1) : 0)) * CHAR_W * size;
  const fs = fit && width > 0 && need > width ? Math.max(Math.floor((size * width) / need), 12) : size;
  const text = (
    <Text style={[s.amount, { fontSize: fs, color }]} numberOfLines={1}>
      {plus && value > 0 ? '+' : ''}{int}{!!cents && <Text style={{ fontSize: Math.round(fs * 0.55), color: C.muted, fontWeight: '500' }}>.{cents}</Text>}
    </Text>
  );
  if (!fit) return text;
  return <View style={{ alignSelf: 'stretch', alignItems: center ? 'center' : 'flex-start' }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>{text}</View>;
}

const PERIOD_NAME = { weekly: 'Semana', biweekly: 'Quincena', monthly: 'Mes' };

// Encabezado del Inicio: periodo, saludo, ojo para ocultar montos y los botones de la cuenta (campana, perfil)
export function HomeHeader({ name, period, start, end, hide, onToggleHide, actions }) {
  return (
    <View style={s.homeHead}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={s.smallMuted} numberOfLines={1}>{PERIOD_NAME[period] || 'Periodo'} {shortDate(start)} – {shortDate(end)}</Text>
        <Text style={s.homeTitle} numberOfLines={1}>{name ? 'Hola, ' + name : 'Hola'}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onToggleHide} style={s.circleBtn} accessibilityLabel={hide ? 'Mostrar montos' : 'Ocultar montos'}>
        <Icon name={hide ? 'eyeOff' : 'eye'} size={20} />
      </Pressable>
      {actions}
    </View>
  );
}

// Tarjeta principal: lo que te queda en el periodo, lo que entró y lo que salió
export function AvailableHero({ income, spent, saved, left, pending, end, prevSpent, hide, onPress, onSaved, onPending }) {
  const fmt = (v) => (hide ? HIDDEN : money(Math.round(v)));
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[s.panel, { padding: 20, gap: 14 }]}>
      <View style={{ gap: 4 }}>
        <Text style={s.eyebrow}>Disponible</Text>
        <Amount value={left} size={40} hide={hide} color={left < 0 ? C.red : C.primary} fit />
      </View>
      <View style={s.tileRow}>
        <Tile label="Ingresos" value={hide ? HIDDEN : '+' + fmt(income)} color={C.green} small={saved > 0} />
        <Tile label="Gastos" value={hide ? HIDDEN : '−' + fmt(spent)} small={saved > 0} />
        {saved > 0 && <Tile label="Ahorraste" value={fmt(saved)} color={C.blue} onPress={onSaved} small />}
      </View>
      {pending > 0 && (
        <Pressable accessibilityRole="button" onPress={onPending} hitSlop={6}>
          <Text style={s.smallMuted}>Por pagar hasta el {shortDate(end)} <Text style={{ fontFamily: MONO, color: C.orange }}>{fmt(pending)}</Text></Text>
        </Pressable>
      )}
      <DeltaChip now={spent} prev={prevSpent} upIsGood={false} label="Gastos vs. el mes pasado a esta fecha" />
    </Pressable>
  );
}

// Reparto del presupuesto (50/30/20...): dona a la izquierda y, por cada parte, lo gastado contra lo que le toca
export function BudgetCard({ spent, income, spentPct, fixedShare, smooth, hide, onMore }) {
  const fmt = (v) => (hide ? HIDDEN : money(Math.round(v)));
  return (
    <Panel title="Tu reparto" right="Ver más detalles" onRight={onMore}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        <BudgetDonut spent={spent} income={income} size={128} center={
          <>
            <Text style={[s.amount, { fontSize: 20, color: C.text }]}>{spentPct}%</Text>
            <Text style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>del ingreso</Text>
          </>
        } />
        <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
          {Object.entries(BUCKETS).map(([k, b]) => {
            const target = (income * b.pct) / 100, over = spent[k] > target && target > 0;
            return (
              <View key={k} style={{ gap: 1 }}>
                <Text style={{ fontFamily: FONT, fontSize: 13, fontWeight: '600', color: b.color }} numberOfLines={1}>{b.label} · {b.pct}%</Text>
                <Text style={[s.rowAmount, { fontSize: 14 }]} numberOfLines={1}>
                  <Text style={over && { color: C.red }}>{fmt(spent[k])}</Text><Text style={{ color: C.muted }}> / {hide ? '•••' : money(Math.round(target)).slice(1)}</Text>
                </Text>
              </View>
            );
          })}
        </View>
      </View>
      {smooth && (
        <Text style={s.smallMuted}>
          La renta, los pagos mensuales y tu nómina se reparten entre los días que cubren{fixedShare > 0 ? ': de gastos fijos cuentan ' + fmt(fixedShare) : ''}.
        </Text>
      )}
    </Panel>
  );
}

// Dos tarjetas chicas: tus cuentas y tu caja de ahorro
export function MoneyTiles({ acc, saved, savedNow, hide, onAccounts, onSavings }) {
  const fmt = (v) => (hide ? HIDDEN : money(Math.round(v)));
  const hasAccounts = acc.rows.length > 0;
  return (
    <View style={[s.tileRow, { gap: 12, marginTop: 14 }]}>
      <Pressable accessibilityRole="button" style={s.statCard} onPress={onAccounts}>
        <Text style={s.tileLabel}>Tus cuentas</Text>
        {hasAccounts ? (
          <>
            <Text style={[s.statCardValue, acc.cash < 0 && { color: C.red }]} numberOfLines={1}>{fmt(acc.cash)}</Text>
            <Text style={[s.tileLabel, { color: acc.debt > 0 ? C.red : C.muted }]} numberOfLines={2}>{acc.debt > 0 ? 'Deuda en tarjetas ' + fmt(acc.debt) : 'Sin deuda en tarjetas'}</Text>
          </>
        ) : (
          <>
            <Text style={[s.panelTitle, { color: C.link }]}>+ Agregar cuenta</Text>
            <Text style={s.tileLabel} numberOfLines={2}>Tarjetas y efectivo</Text>
          </>
        )}
      </Pressable>
      <Pressable accessibilityRole="button" style={s.statCard} onPress={onSavings}>
        <Text style={s.tileLabel}>Caja de ahorro</Text>
        <Text style={s.statCardValue} numberOfLines={1}>{fmt(saved)}</Text>
        <Text style={[s.tileLabel, savedNow > 0 && { color: C.green }]} numberOfLines={2}>{savedNow > 0 ? '+ ' + fmt(savedNow) + ' este periodo' : 'Ver tus metas'}</Text>
      </Pressable>
    </View>
  );
}

// Pagos de los próximos 7 días en recuadros
export function UpcomingPanel({ items, icons, hide }) {
  const fmt = (v) => (hide ? HIDDEN : money(Math.round(v)));
  const total = items.reduce((a, u) => a + u.m.amount, 0);
  const day = (d) => d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }).replace('.', '').toUpperCase();
  return (
    <Panel title="Próximos 7 días" right={<Text style={s.tileLabel}>Total por pagar <Text style={[s.rowAmount, { fontSize: 12, color: C.orange }]}>{fmt(total)}</Text></Text>} style={{ borderRadius: 20, padding: 16, gap: 10 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {items.map((u, i) => (
          <View key={u.m.id + '-' + i} style={[s.tile, { minWidth: 120, flex: 0 }]}>
            <Text style={[s.tileLabel, { fontSize: 11 }]}>{day(u.d)}</Text>
            <Text style={[s.rowTitle, { fontSize: 14 }]} numberOfLines={1}>{icons(u)} {u.m.note || u.m.cat}</Text>
            <Text style={[s.rowAmount, { fontSize: 13, color: C.muted }]}>{fmt(u.m.amount)}</Text>
          </View>
        ))}
      </ScrollView>
    </Panel>
  );
}
