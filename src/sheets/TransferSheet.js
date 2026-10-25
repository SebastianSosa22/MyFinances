import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { TopSheet } from '../components/TopSheet';
import { ACCOUNT_TYPES, accountBalance, adjustmentFor, isCredit } from '../lib/accounts';
import { cleanAmount, money, showAmount } from '../lib/format';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

const Chip = ({ a, on, onPress }) => (
  <Pressable onPress={onPress} style={[s.fChip, on && s.fChipOn]}>
    <Text style={[s.fChipText, on && { color: '#fff', fontWeight: '600' }]}>{ACCOUNT_TYPES[a.type].icon} {a.name}{a.last4 ? ' ' + a.last4 : ''}</Text>
  </Pressable>
);

// Un ajuste de saldo ya guardado solo se puede borrar (para corregirlo, se vuelve a ajustar)
function AdjustInfo({ visible, edit, accounts, onClose, onDelete }) {
  const a = accounts.find((x) => x.id === (edit.to_account_id || edit.from_account_id));
  const up = !!edit.to_account_id;
  return (
    <TopSheet visible={visible} onClose={onClose} title="Ajuste de saldo" onSave={onClose} saveLabel="Listo">
      <Text style={[s.amountInput, { fontSize: 32 }]}>{(up ? '+' : '−') + money(edit.amount, true)}</Text>
      <Text style={[s.balanceSub, { textAlign: 'center' }]}>
        {(a ? a.name + ': ' : '') + (isCredit(a) ? (up ? 'la deuda bajó' : 'la deuda subió') : up ? 'el saldo subió' : 'el saldo bajó') + ' el ' + new Date(edit.occurred_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) + '. No cuenta como gasto ni ingreso.'}
      </Text>
      <Pressable onPress={async () => { if (await onDelete(edit.id)) onClose(); }} style={{ marginTop: 18, marginBottom: 6 }}>
        <Text style={[s.link, { color: C.red, textAlign: 'center' }]}>Borrar ajuste</Text>
      </Pressable>
    </TopSheet>
  );
}

// Mover dinero entre tus cuentas (por ejemplo, pagar la tarjeta de crédito desde el débito). No cuenta como gasto ni ingreso.
// `start` trae la cuenta de origen y/o destino ya elegidas; con `edit` se cambia o se borra una transferencia existente.
// Quien la usa le pone un `key` distinto al abrirla para que arranque limpia.
export function TransferSheet(props) {
  const { edit } = props;
  if (edit && edit.kind === 'adjust') return <AdjustInfo {...props} />;
  return <TransferForm {...props} />;
}

function TransferForm({ visible, accounts, moves, transfers, start = {}, edit, onClose, onSave, onDelete }) {
  const active = accounts.filter((a) => !a.archived || (edit && (a.id === edit.from_account_id || a.id === edit.to_account_id)));
  const [from, setFrom] = useState(edit ? edit.from_account_id : start.from || null);
  const [to, setTo] = useState(edit ? edit.to_account_id : start.to || null);
  const [amount, setAmount] = useState(edit ? String(edit.amount) : '');
  const [note, setNote] = useState(edit && edit.note ? edit.note : '');
  const [error, setError] = useState('');
  const toAcc = active.find((a) => a.id === to);
  const fromAcc = active.find((a) => a.id === from);
  const paying = isCredit(toAcc) && !isCredit(fromAcc);
  // Deuda de la tarjeta a pagar (sin contar esta misma transferencia si se está editando)
  const debt = paying ? accountBalance(toAcc, moves, transfers.filter((t) => !edit || t.id !== edit.id)).debt : 0;

  const save = async () => {
    const n = parseFloat(amount) || 0;
    if (!from || !to) { setError('Elige de qué cuenta sale y a cuál llega.'); return; }
    if (from === to) { setError('Elige dos cuentas distintas.'); return; }
    if (!(n > 0)) { setError('Escribe un monto mayor a $0.'); return; }
    const row = { kind: 'transfer', from_account_id: from, to_account_id: to, amount: n, note: note.trim() || null };
    if (!edit) row.occurred_at = new Date().toISOString();
    if (await onSave(row, edit ? edit.id : null)) onClose();
  };

  return (
    <TopSheet visible={visible} onClose={onClose} title={edit ? 'Editar transferencia' : paying ? 'Pagar tarjeta' : 'Transferir'} onSave={save} saveLabel={edit ? 'Guardar' : paying ? 'Pagar' : 'Transferir'}>
      <TextInput value={showAmount(amount)} onChangeText={(x) => { setAmount(cleanAmount(x)); setError(''); }} keyboardType="decimal-pad" placeholder="$0.00" placeholderTextColor={C.muted} style={s.amountInput} autoFocus={!edit} />
      {paying && debt > 0 && (
        <View style={[s.chipsRow, { justifyContent: 'center', marginTop: -4 }]}>
          <Pressable onPress={() => setAmount(String(debt))} style={s.fChip}><Text style={[s.fChipText, { color: C.link }]}>Deuda total {money(debt, true)}</Text></Pressable>
        </View>
      )}
      <Text style={[s.balanceSub, { marginTop: 12 }]}>Sale de</Text>
      <View style={s.chipsRow}>{active.map((a) => <Chip key={a.id} a={a} on={from === a.id} onPress={() => { setFrom(a.id); if (to === a.id) setTo(null); setError(''); }} />)}</View>
      <Text style={[s.balanceSub, { marginTop: 12 }]}>Llega a</Text>
      <View style={s.chipsRow}>{active.filter((a) => a.id !== from).map((a) => <Chip key={a.id} a={a} on={to === a.id} onPress={() => { setTo(a.id); setError(''); }} />)}</View>
      <TextInput style={s.input} placeholder="Nota (opcional)" placeholderTextColor={C.muted} value={note} onChangeText={setNote} maxLength={80} />
      {!!error && <Text style={[s.hint, { color: C.red }]}>{error}</Text>}
      <Text style={[s.balanceSub, { marginTop: 12 }]}>Mover dinero entre tus cuentas no cuenta como gasto ni ingreso, así que no afecta tus presupuestos.</Text>
      {!!edit && (
        <Pressable onPress={async () => { if (await onDelete(edit.id)) onClose(); }} style={{ marginTop: 18, marginBottom: 6 }}>
          <Text style={[s.link, { color: C.red, textAlign: 'center' }]}>Borrar transferencia</Text>
        </Pressable>
      )}
    </TopSheet>
  );
}

// Ajustar saldo: escribes lo que dice tu banco y se guarda la diferencia como ajuste (no es gasto ni ingreso)
export function AdjustSheet({ visible, account, moves, transfers, onClose, onSave }) {
  const credit = isCredit(account);
  const b = accountBalance(account, moves, transfers);
  const current = credit ? b.debt : b.balance;
  const [real, setReal] = useState('');
  const n = real === '' ? null : parseFloat(real) || 0;
  const adj = n == null ? null : adjustmentFor(account, current, n);

  const save = async () => {
    if (n == null) return;
    if (!adj) { onClose(); return; }
    if (await onSave({ ...adj, note: 'Ajuste de saldo', occurred_at: new Date().toISOString() })) onClose();
  };

  return (
    <TopSheet visible={visible} onClose={onClose} title="Ajustar saldo" onSave={save}>
      <Text style={[s.balanceSub, { marginTop: 12, textAlign: 'center' }]}>
        {credit ? 'Según la app debes ' : 'Según la app tienes '}{money(current, true)}. {credit ? '¿Cuánto dice tu banco que debes?' : '¿Cuánto dice tu banco que tienes?'}
      </Text>
      <TextInput value={showAmount(real)} onChangeText={(x) => setReal(cleanAmount(x))} keyboardType="decimal-pad" placeholder="$0.00" placeholderTextColor={C.muted} style={s.amountInput} autoFocus />
      {n != null && (
        <Text style={[s.balanceSub, { textAlign: 'center' }]}>
          {!adj ? 'Ya coincide, no hay nada que ajustar.' : (credit ? 'Tu deuda ' + (adj.to_account_id ? 'baja ' : 'sube ') : 'Tu saldo ' + (adj.to_account_id ? 'sube ' : 'baja ')) + money(adj.amount, true) + '. No cuenta como gasto ni ingreso.'}
        </Text>
      )}
    </TopSheet>
  );
}
