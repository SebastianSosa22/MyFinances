import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Amount, HIDDEN } from '../components/HomeCards';
import { Icon } from '../components/Icon';
import { Bar, Title } from '../components/ui';
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
    <Pressable style={[s.row, { paddingVertical: 14 }, !first && s.sep]} onPress={onPress}>
      <View style={[s.catIcon, { width: 44, height: 44, marginRight: 12 }]}><Text style={{ fontSize: 22 }}>{ACCOUNT_TYPES[a.type].icon}</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.body} numberOfLines={1}>{a.name}</Text>
        <Text style={[s.balanceSub, { marginTop: 2 }]} numberOfLines={1}>{ACCOUNT_TYPES[a.type].label}{a.last4 ? ' · •••• ' + a.last4 : ''}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
        {isCredit(a)
          ? <><Text style={[s.body, { fontWeight: '600', color: row.debt > 0 ? C.red : C.text }]}>{row.debt > 0 ? '−' : ''}{fmt(Math.abs(row.debt))}</Text>
            {row.available != null && <Text style={[s.balanceSub, { marginTop: 2 }]}>disp. {fmt(row.available)}</Text>}</>
          : <Text style={[s.body, { fontWeight: '600', color: row.balance < 0 ? C.red : C.text }]}>{fmt(row.balance)}</Text>}
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
      <View style={s.screenHead}>
        <Pressable onPress={onBack} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center' }} accessibilityLabel="Regresar a cuentas">
          <Icon name="chevronLeft" size={22} color={C.link} /><Text style={s.link}>Cuentas</Text>
        </Pressable>
        <Pressable onPress={onEdit} hitSlop={10}><Text style={s.link}>Editar</Text></Pressable>
      </View>
      <Text style={s.screenTitle} numberOfLines={2}>{accountLabel(a)}</Text>
      <View style={[s.card, { padding: 16 }]}>
        <Text style={s.balanceLabel}>{isCredit(a) ? 'Deuda actual' : 'Saldo'}</Text>
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
      <View style={[s.chipsRow, { marginTop: 4 }]}>
        {isCredit(a)
          ? <Pressable onPress={() => onTransfer({ from: payFrom ? payFrom.id : null, to: a.id })} style={[s.fChip, s.fChipOn]}><Text style={[s.fChipText, { color: '#fff', fontWeight: '600' }]}>Pagar tarjeta</Text></Pressable>
          : others.length > 0 && <Pressable onPress={() => onTransfer({ from: a.id })} style={[s.fChip, s.fChipOn]}><Text style={[s.fChipText, { color: '#fff', fontWeight: '600' }]}>Transferir</Text></Pressable>}
        <Pressable onPress={() => onAdjust(a)} style={s.fChip}><Text style={[s.fChipText, { color: C.link }]}>Ajustar saldo</Text></Pressable>
      </View>
      <Title>Historial de la cuenta</Title>
      <View style={s.card}>
        {list.length === 0 && <Text style={[s.hint, { marginBottom: 16 }]}>Al registrar un gasto o ingreso, elige esta cuenta para verlo aquí.</Text>}
        {list.map(({ key, m, t }, i) => {
          // Para la cuenta, + es dinero que entra (en crédito: la deuda baja)
          const sign = m ? (m.kind === 'income' ? 1 : -1) : transferSign(t, a.id);
          const amt = m ? m.amount : t.amount;
          return (
            <Pressable key={key} style={[s.row, i > 0 && s.sep]} onPress={() => (m ? onEditMove(m) : onEditTransfer(t))}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.body} numberOfLines={1}>{m ? moveTitle(m) : transferTitle(t, a.id, accounts)}</Text>
                <Text style={[s.balanceSub, { marginTop: 2 }]} numberOfLines={1}>
                  {m ? (isRecurring(m) ? freqLabel(asExp(m)) : shortDate(new Date(m.occurred_at))) : shortDate(new Date(t.occurred_at)) + (t.note && t.kind !== 'adjust' ? ' · ' + t.note : ' · no es gasto ni ingreso')}
                </Text>
              </View>
              <Text style={[s.body, { fontWeight: '600', color: sign > 0 ? C.green : C.text }]}>{hide ? HIDDEN : (sign > 0 ? '+' : '−') + money(amt, true)}</Text>
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

  return (
    <>
      <View style={s.screenHead}>
        <Pressable onPress={onBack} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center' }} accessibilityLabel="Regresar al inicio">
          <Icon name="chevronLeft" size={22} color={C.link} /><Text style={s.link}>Inicio</Text>
        </Pressable>
      </View>
      <Text style={s.screenTitle}>Tus cuentas</Text>
      {sum.rows.length > 0 && (
        <View style={[s.card, s.balanceCard]}>
          <View style={s.balanceHalf}>
            <Text style={s.balanceLabel}>Dinero disponible</Text>
            <Amount value={sum.cash} size={28} hide={hide} color={sum.cash < 0 ? C.red : C.text} fit />
          </View>
          <View style={s.balanceDivider} />
          <View style={s.balanceHalf}>
            <Text style={s.balanceLabel}>Deuda en tarjetas</Text>
            <Amount value={sum.debt} size={28} hide={hide} color={sum.debt > 0 ? C.red : C.text} fit />
          </View>
        </View>
      )}
      <View style={s.card}>
        {sum.rows.length === 0 && (
          <View style={{ padding: 16 }}>
            <Text style={[s.body, { fontWeight: '600' }]}>Registra tus tarjetas y tu efectivo</Text>
            <Text style={s.balanceSub}>Así sabes cuánto tienes en cada cuenta y cuánto debes en tus tarjetas de crédito.</Text>
          </View>
        )}
        {sum.rows.map((r, i) => <AccountRow key={r.a.id} row={r} hide={hide} first={i === 0} onPress={() => setOpenId(r.a.id)} />)}
      </View>
      <Pressable style={[s.addBtn, { marginTop: 16 }]} onPress={onNew}><Text style={s.addBtnText}>+ Agregar cuenta</Text></Pressable>
      {sum.rows.length > 1 && <Pressable onPress={() => onTransfer({})} style={{ marginBottom: 16 }}><Text style={[s.link, { textAlign: 'center' }]}>Transferir entre cuentas</Text></Pressable>}
      <Text style={[s.balanceSub, { textAlign: 'center' }]}>🔒 Solo guardamos el nombre y, si quieres, los últimos 4 dígitos. Nunca el número completo ni el CVV.</Text>
    </>
  );
}
