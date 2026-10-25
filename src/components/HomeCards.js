import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { BudgetDonut } from './BudgetDonut';
import { Icon } from './Icon';
import { BUCKETS } from '../constants/budget';
import { money, shortDate } from '../lib/format';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

export const HIDDEN = '$•••';

// Monto con los centavos más chicos y tenues: $2,500.00.
// Con `fit`, mide el espacio disponible y reduce la letra si el monto no cabe (adjustsFontSizeToFit no existe en la web).
// Solo sirve donde el contenedor tiene un ancho propio (una columna con flex), no en una fila que se ajusta al texto.
const CHAR_W = 0.62; // ancho aproximado de un dígito en negritas, en proporción al tamaño de letra
export function Amount({ value, size = 28, color = C.text, hide, center, fit, plus }) {
  const [width, setWidth] = useState(0);
  const [int, cents] = hide ? [HIDDEN, ''] : money(value, true).split('.');
  const need = (int.length + (cents ? 0.55 * (cents.length + 1) : 0)) * CHAR_W * size;
  const fs = fit && width > 0 && need > width ? Math.max(Math.floor((size * width) / need), 12) : size;
  const text = (
    <Text style={[s.amount, { fontSize: fs, color }]} numberOfLines={1}>
      {plus && value > 0 ? '+' : ''}{int}{!!cents && <Text style={{ fontSize: Math.round(fs * 0.55), color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>.{cents}</Text>}
    </Text>
  );
  if (!fit) return text;
  return <View style={{ alignSelf: 'stretch', alignItems: center ? 'center' : 'flex-start' }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>{text}</View>;
}

export function Greeting({ name, hide, onToggleHide }) {
  return (
    <View style={s.greetRow}>
      <Text style={s.greetBig} numberOfLines={1}>{name ? 'Hola, ' + name : 'Hola'}</Text>
      <Pressable onPress={onToggleHide} hitSlop={12} style={{ marginLeft: 14 }} accessibilityLabel={hide ? 'Mostrar montos' : 'Ocultar montos'}>
        <Icon name={hide ? 'eyeOff' : 'eye'} size={26} color={C.muted} />
      </Pressable>
    </View>
  );
}

const PERIOD_TEXT = { weekly: 'Esta semana has gastado', biweekly: 'Esta quincena has gastado' };

// Tarjeta principal: cuánto gastaste en el periodo y, abajo, lo que entró, lo que ahorraste y lo que te queda
// left: lo que queda tras lo gastado, lo ahorrado y los pagos que faltan (Por pagar)
export function SpentHero({ period, now, income, spent, saved, left, hide, onPress, onSaved }) {
  const title = PERIOD_TEXT[period] || 'En ' + now.toLocaleDateString('es-MX', { month: 'long' }) + ' has gastado';
  return (
    <Pressable onPress={onPress} style={s.heroCard}>
      <View style={s.heroChevron}><Icon name="chevron" size={22} color="rgba(255,255,255,0.7)" /></View>
      <Text style={s.heroTitle}>{title}</Text>
      <View style={{ marginTop: 6 }}><Amount value={spent} size={52} hide={hide} center fit /></View>
      <View style={s.heroRow}>
        <HeroStat label="Entraron" value={income} hide={hide} />
        <View style={s.heroDivider} />
        <Pressable style={{ flex: 1 }} onPress={onSaved} hitSlop={6}>
          <HeroStat label="Ahorraste" value={saved} hide={hide} />
        </Pressable>
        <View style={s.heroDivider} />
        <HeroStat label="Te quedan" value={left} hide={hide} color={left < 0 ? C.red : '#A7F3C0'} />
      </View>
    </Pressable>
  );
}

const HeroStat = ({ label, value, hide, color }) => (
  <View style={{ flex: 1, alignItems: 'center', minWidth: 0 }}>
    <Text style={s.heroLabel} numberOfLines={1}>{label}</Text>
    <Amount value={value} size={22} hide={hide} color={color} center fit />
  </View>
);

// Tienes (saldo acumulado: efectivo + ahorro) y Por pagar (pagos fijos que faltan en el periodo y pagos de tarjeta que vencen en él).
// Los pagos de tarjeta solo se muestran aquí: no se restan de "Te quedan" porque las compras ya contaron como gasto al hacerlas.
export function BalanceCard({ balance, pending, pendingSpread = 0, cards = { items: [], total: 0, missing: [] }, end, hide, onBalance, onPending, onCards }) {
  const fmt = (v) => (hide ? HIDDEN : money(v, true));
  const withCards = cards.total > 0;
  return (
    <View style={[s.card, s.balanceCard]}>
      <Pressable style={s.balanceHalf} onPress={onBalance}>
        <View style={s.balanceHead}><Text style={s.balanceLabel}>Tienes</Text><Icon name="chevron" size={20} color={C.muted} /></View>
        <Amount value={balance.total} size={30} hide={hide} color={balance.total < 0 ? C.red : C.text} fit />
        <View style={s.chipsRow}>
          <Dot label="Efectivo" value={balance.cash} hide={hide} color={C.green} />
          {balance.saved > 0 && <Dot label="Ahorro" value={balance.saved} hide={hide} color="#5B9BFF" />}
        </View>
      </Pressable>
      <View style={s.balanceDivider} />
      <Pressable style={s.balanceHalf} onPress={onPending}>
        <View style={s.balanceHead}><Text style={s.balanceLabel}>Por pagar</Text><Icon name="chevron" size={20} color={C.muted} /></View>
        <Amount value={pending + cards.total} size={30} hide={hide} fit />
        {withCards ? (
          <>
            <Text style={s.balanceSub}>Pagos fijos {fmt(pending)} · Tarjetas {fmt(cards.total)}</Text>
            <Pressable onPress={onCards} hitSlop={6}>
              <Text style={[s.balanceSub, { marginTop: 4 }]}>
                {cards.items.map((x) => '💳 ' + x.a.name + ' vence el ' + shortDate(x.d)).join('\n')}{'\nNo se resta de «Te quedan»: tus compras ya contaron.'}
              </Text>
            </Pressable>
          </>
        ) : (
          <Text style={s.balanceSub}>{pending > 0 ? 'Pagos fijos hasta el ' + shortDate(end) + (pendingSpread > 0 ? '; su parte de estos días ya va en lo gastado' : '') : 'Sin pagos fijos pendientes'}</Text>
        )}
        {cards.missing.length > 0 && (
          <Pressable onPress={onCards} hitSlop={6}>
            <Text style={[s.balanceSub, { marginTop: 4, color: C.link }]}>Agrega el día de pago de {cards.missing.map((a) => a.name).join(', ')} para verlo aquí</Text>
          </Pressable>
        )}
      </Pressable>
    </View>
  );
}

const Dot = ({ label, value, hide, color }) => (
  <View style={s.dotChip}>
    <View style={[s.dotRing, { borderColor: color }]} />
    <Text style={s.dotText} numberOfLines={1}>{label}{hide ? '' : ' ' + money(Math.round(value))}</Text>
  </View>
);

// Reparto del presupuesto (50/30/20...): dona y, por cada parte, lo gastado contra lo que le toca
export function BudgetCard({ spent, income, spentPct, fixedShare, smooth, hide }) {
  const split = Object.values(BUCKETS).map((b) => b.pct).join('/');
  return (
    <View style={[s.card, { padding: 16 }]}>
      <Text style={s.balanceLabel}>Tu reparto {split}</Text>
      <BudgetDonut spent={spent} income={income} size={190} center={
        <>
          <Text style={[s.amount, { fontSize: 34, color: C.text }]}>{spentPct}%</Text>
          <Text style={[s.balanceSub, { marginTop: 0 }]}>de tus ingresos</Text>
        </>
      } />
      <View style={{ marginTop: 12 }}>
        {Object.entries(BUCKETS).map(([k, b], i) => {
          const target = (income * b.pct) / 100, over = spent[k] > target && target > 0;
          return (
            <View key={k} style={[s.budgetRow, i > 0 && s.sep]}>
              <View style={[s.dotRing, { borderColor: b.color, marginTop: 1 }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.body} numberOfLines={1}>{b.label}</Text>
                <Text style={[s.balanceSub, { marginTop: 2 }]}>{b.pct}% · te tocan {hide ? HIDDEN : money(Math.round(target))}</Text>
              </View>
              <Amount value={spent[k]} size={20} hide={hide} color={over ? C.red : C.text} />
            </View>
          );
        })}
      </View>
      {smooth && (
        <Text style={[s.balanceSub, { marginTop: 8 }]}>
          🏠 En esta vista, la renta, los pagos mensuales y tu nómina se reparten entre los días que cubren{fixedShare > 0 ? ': de gastos fijos cuentan ' + (hide ? HIDDEN : money(fixedShare, true)) : ''}.
        </Text>
      )}
    </View>
  );
}
