import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Amount, HIDDEN } from '../components/HomeCards';
import { Bar } from '../components/ui';
import { ACCOUNT_TYPES, accountBalance, accountLabel, accountsSummary, isCredit, nextMonthDay, transferSign } from '../lib/accounts';
import { asExp, freqLabel, isRecurring, moveTitle } from '../lib/finance';
import { money, shortDate } from '../lib/format';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

// Fila de una cuenta: ícono, nombre y su saldo (en crédito: lo que debes y lo disponible)
export function AccountRow({ row, hide, first, onPress }) {
  const { a } = row;
  const fmt = (v) => (hide ? HIDDEN : money(v, true));
  return (
    <Pressable accessibilityRole="button" style={[s.row, { paddingVertical: 12, paddingHorizontal: 14, gap: 12 }, !first && s.formSep]} onPress={onPress}>
      <View style={[s.catBadge, { width: 40, height: 40, backgroundColor: isCredit(a) ? '#3A1F26' : a.type === 'cash' ? '#13362A' : '#1B2A44' }]}><Text style={{ fontSize: 18 }}>{ACCOUNT_TYPES[a.type].icon}</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.rowTitle} numberOfLines={1}>{a.name}{a.last4 ? ' •••• ' + a.last4 : ''}</Text>
        <Text style={s.rowSub} numberOfLines={1}>{isCredit(a) ? 'Deuda actual' + (a.cut_day ? ' · corte día ' + a.cut_day : '') : 'Saldo'}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
        {isCredit(a)
          ? <><Text style={[s.rowAmount, { color: row.debt > 0 ? C.red : C.text }]}>{row.debt > 0 ? '−' : ''}{fmt(Math.abs(row.debt))}</Text>
            {row.available != null && <Text style={s.rowSub}>disp. {fmt(row.available)}</Text>}</>
          : <Text style={[s.rowAmount, { color: row.balance < 0 ? C.red : C.text }]}>{fmt(row.balance)}</Text>}
      </View>
    </Pressable>
  );
}

// Título de una transferencia o ajuste visto desde la cuenta `id`
function transferTitle(t, id, accounts) {
  if (t.kind === 'adjust') return 'Ajuste de saldo';
  const other = accounts.find((x) => x.id === (t.to_account_id === id ? t.from_account_id : t.to_account_id));
  const me = accounts.find((x) => x.id === id);
  const name = other ? other.name : 'otra cuenta';
  if (isCredit(me) && t.to_account_id === id) return 'Pago de tarjeta · desde ' + name;
  if (isCredit(other) && t.from_account_id === id) return 'Pago de ' + name;
  return t.to_account_id === id ? 'Transferencia desde ' + name : 'Transferencia a ' + name;
}

// Detalle de una cuenta: saldo (o deuda y crédito usado), fechas de la tarjeta, acciones y su historial
function AccountDetail({ a, accounts, moves, transfers, hide, onBack, onEdit, onEditMove, onTransfer, onEditTransfer, onAdjust }) {
  const b = accountBalance(a, moves, transfers);
  // Movimientos y transferencias de la cuenta, de lo más reciente a lo más antiguo
  const list = [
    ...moves.filter((m) => m.account_id === a.id).map((m) => ({ key: m.id, at: new Date(m.occurred_at), m })),
    ...transfers.filter((t) => transferSign(t, a.id)).map((t) => ({ key: t.id, at: new Date(t.occurred_at), t })),
  ].sort((x, y) => y.at - x.at).slice(0, 40);
  const others = accounts.filter((x) => x.id !== a.id && !x.archived);
  const payFrom = others.find((x) => !isCredit(x));
  const used = isCredit(a) && a.credit_limit ? b.debt + b.msiLeft : 0;
  return (
    <>
      <View style={[s.panelHead, { alignItems: 'center' }]}>
        <Pressable accessibilityRole="button" onPress={onBack} hitSlop={10} style={{ paddingVertical: 6 }} accessibilityLabel="Regresar a cuentas"><Text style={[s.linkSm, { fontSize: 15 }]}>‹ Cuentas</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={onEdit} hitSlop={10}><Text style={[s.linkSm, { fontSize: 15 }]}>Editar</Text></Pressable>
      </View>
      <Text style={s.screenTitle} numberOfLines={2}>{accountLabel(a)}</Text>
      <View style={[s.panel, { gap: 6 }]}>
        <Text style={s.eyebrow}>{isCredit(a) ? 'Deuda actual' : 'Saldo'}</Text>
        <Amount value={isCredit(a) ? b.debt : b.balance} size={36} hide={hide} color={isCredit(a) ? (b.debt > 0 ? C.red : C.text) : b.balance < 0 ? C.red : C.text} fit />
        {isCredit(a) && a.credit_limit > 0 && (
          <>
            <View style={{ marginTop: 10 }}><Bar spent={used} budget={a.credit_limit} color={C.link} /></View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={s.balanceSub}>Usado {Math.round((Math.max(used, 0) / a.credit_limit) * 100)}%</Text>
              <Text style={s.balanceSub}>Límite {hide ? HIDDEN : money(a.credit_limit)}</Text>
            </View>
            <Text style={s.balanceSub}>Disponible {hide ? HIDDEN : money(b.available, true)}{b.msiLeft > 0 ? ' · ' + (hide ? HIDDEN : money(b.msiLeft, true)) + ' apartado en MSI' : ''}</Text>
          </>
        )}
        {isCredit(a) && (a.cut_day || a.due_day) && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            {!!a.cut_day && <View style={[s.dotChip, { flex: 1 }]}><Text style={s.dotText}>Corte · {shortDate(nextMonthDay(a.cut_day))}</Text></View>}
            {!!a.due_day && <View style={[s.dotChip, { flex: 1 }]}><Text style={s.dotText}>Pagar antes del {shortDate(nextMonthDay(a.due_day))}</Text></View>}
          </View>
        )}
      </View>
      <View style={[s.tileRow, { marginTop: 12 }]}>
        {isCredit(a)
          ? <Pressable accessibilityRole="button" onPress={() => onTransfer({ from: payFrom ? payFrom.id : null, to: a.id })} style={[s.ghostBtn, s.actionBtn, { backgroundColor: C.primary, borderColor: C.primary }]}><Text style={[s.panelTitle, { fontSize: 14, color: C.onPrimary }]}>Pagar tarjeta</Text></Pressable>
          : others.length > 0 && <Pressable accessibilityRole="button" onPress={() => onTransfer({ from: a.id })} style={[s.ghostBtn, s.actionBtn, { backgroundColor: C.primary, borderColor: C.primary }]}><Text style={[s.panelTitle, { fontSize: 14, color: C.onPrimary }]}>⇄ Transferir</Text></Pressable>}
        <Pressable accessibilityRole="button" onPress={() => onAdjust(a)} style={[s.ghostBtn, s.actionBtn]}><Text style={[s.panelTitle, { fontSize: 14, color: C.link }]}>Ajustar saldo</Text></Pressable>
      </View>
      <Text style={[s.sectionTitle, { marginLeft: 2 }]}>Historial de la cuenta · {ACCOUNT_TYPES[a.type].label}</Text>
      <View style={[s.formList, { paddingHorizontal: 0, borderRadius: 18 }]}>
        {list.length === 0 && <Text style={[s.smallMuted, { padding: 16 }]}>Al registrar un gasto o ingreso, elige esta cuenta para verlo aquí.</Text>}
        {list.map(({ key, m, t }, i) => {
          // Para la cuenta, + es dinero que entra (en crédito: la deuda baja)
          const sign = m ? (m.kind === 'income' ? 1 : -1) : transferSign(t, a.id);
          const amt = m ? m.amount : t.amount;
          return (
            <Pressable accessibilityRole="button" key={key} style={[s.row, { paddingHorizontal: 14, gap: 10 }, i > 0 && s.formSep]} onPress={() => (m ? onEditMove(m) : onEditTransfer(t))}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.rowTitle, { fontSize: 14 }]} numberOfLines={1}>{m ? moveTitle(m) : transferTitle(t, a.id, accounts)}</Text>
                <Text style={s.rowSub} numberOfLines={1}>
                  {m ? (isRecurring(m) ? freqLabel(asExp(m)) : shortDate(new Date(m.occurred_at))) : shortDate(new Date(t.occurred_at)) + (t.note && t.kind !== 'adjust' ? ' · ' + t.note : ' · no es gasto ni ingreso')}
                </Text>
              </View>
              <Text style={[s.rowAmount, { fontSize: 14, color: sign > 0 ? C.green : C.text }]}>{hide ? HIDDEN : (sign > 0 ? '+' : '−') + money(amt, true)}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

// Cuentas: tus tarjetas de débito y crédito y tu efectivo, con el saldo de cada una
export function AccountsScreen({ accounts, moves, transfers, hide, onBack, onNew, onEdit, onEditMove, onTransfer, onEditTransfer, onAdjust }) {
  const [openId, setOpenId] = useState(null);
  const dayKey = new Date().toDateString();
  const sum = useMemo(() => accountsSummary(accounts, moves, transfers), [accounts, moves, transfers, dayKey]);
  const open = accounts.find((a) => a.id === openId);
  if (open) {
    return <AccountDetail a={open} accounts={accounts} moves={moves} transfers={transfers} hide={hide} onBack={() => setOpenId(null)} onEdit={() => onEdit(open)}
      onEditMove={onEditMove} onTransfer={onTransfer} onEditTransfer={onEditTransfer} onAdjust={onAdjust} />;
  }

  const fmt = (v) => (hide ? HIDDEN : money(Math.round(v)));
  const card = sum.rows.find((r) => isCredit(r.a) && r.debt > 0);
  const debit = sum.rows.find((r) => !isCredit(r.a));
  return (
    <>
      <Pressable accessibilityRole="button" onPress={onBack} hitSlop={10} style={{ alignSelf: 'flex-start', paddingVertical: 6 }} accessibilityLabel="Regresar al inicio">
        <Text style={[s.linkSm, { fontSize: 15 }]}>‹ Inicio</Text>
      </Pressable>
      <Text style={s.screenTitle}>Tus cuentas</Text>
      {sum.rows.length > 0 && (
        <>
          <View style={[s.tileRow, { gap: 12, marginTop: 14 }]}>
            <View style={s.statCard}>
              <Text style={s.tileLabel}>Dinero disponible</Text>
              <Text style={[s.statCardValue, { fontSize: 22 }, sum.cash < 0 && { color: C.red }]} numberOfLines={1}>{fmt(sum.cash)}</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.tileLabel}>Deuda en tarjetas</Text>
              <Text style={[s.statCardValue, { fontSize: 22, color: sum.debt > 0 ? C.red : C.text }]} numberOfLines={1}>{fmt(sum.debt)}</Text>
            </View>
          </View>
          {(sum.rows.length > 1 || !!card) && (
            <View style={[s.tileRow, { marginTop: 12 }]}>
              {sum.rows.length > 1 && <Pressable accessibilityRole="button" style={[s.ghostBtn, s.actionBtn]} onPress={() => onTransfer({})}><Text style={[s.panelTitle, { fontSize: 14 }]}>⇄ Transferir</Text></Pressable>}
              {!!card && <Pressable accessibilityRole="button" style={[s.ghostBtn, s.actionBtn]} onPress={() => onTransfer({ from: debit ? debit.a.id : null, to: card.a.id })}><Text style={[s.panelTitle, { fontSize: 14 }]}>💳 Pagar tarjeta</Text></Pressable>}
            </View>
          )}
        </>
      )}
      <View style={[s.formList, { paddingHorizontal: 0, marginTop: 14, borderRadius: 20 }]}>
        {sum.rows.length === 0 && (
          <View style={{ padding: 16, gap: 4 }}>
            <Text style={s.panelTitle}>Registra tus tarjetas y tu efectivo</Text>
            <Text style={s.smallMuted}>Así sabes cuánto tienes en cada cuenta y cuánto debes en tus tarjetas de crédito.</Text>
          </View>
        )}
        {sum.rows.map((r, i) => <AccountRow key={r.a.id} row={r} hide={hide} first={i === 0} onPress={() => setOpenId(r.a.id)} />)}
      </View>
      <Pressable accessibilityRole="button" style={s.outlineBtn} onPress={onNew}><Text style={[s.panelTitle, { fontSize: 15 }]}>+ Agregar cuenta</Text></Pressable>
      <Text style={[s.smallMuted, { textAlign: 'center', marginTop: 14 }]}>🔒 Solo guardamos el nombre y, si quieres, los últimos 4 dígitos. Nunca el número completo ni el CVV.</Text>
    </>
  );
}
