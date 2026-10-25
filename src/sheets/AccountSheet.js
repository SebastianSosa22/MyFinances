import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { TopSheet } from '../components/TopSheet';
import { Segmented } from '../components/ui';
import { ACCOUNT_TYPES } from '../lib/accounts';
import { cleanAmount, showAmount } from '../lib/format';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

const TYPE_OPTS = Object.fromEntries(Object.entries(ACCOUNT_TYPES).map(([k, t]) => [k, { label: t.label }]));
const NAME_HINT = { debit: 'Nombre (ej. BBVA Débito)', credit: 'Nombre (ej. Nu Crédito)', cash: 'Nombre (ej. Cartera)' };
const digits = (x, n) => x.replace(/[^0-9]/g, '').slice(0, n);
const dayOk = (x) => x === '' || (Number(x) >= 1 && Number(x) <= 31);

// Alta o edición de una tarjeta/cuenta. Quien la usa le pone un `key` distinto al abrirla para que arranque con los valores de `account`.
// Nunca se pide el número completo de la tarjeta: solo un nombre y, si quieres, los últimos 4 dígitos.
export function AccountSheet({ visible, account, onClose, onSave, onDelete }) {
  const a = account;
  const [type, setType] = useState(a ? a.type : 'debit');
  const [name, setName] = useState(a ? a.name : '');
  const [last4, setLast4] = useState(a && a.last4 ? a.last4 : '');
  const [opening, setOpening] = useState(a && a.opening_balance ? String(a.opening_balance) : '');
  const [limit, setLimit] = useState(a && a.credit_limit ? String(a.credit_limit) : '');
  const [cut, setCut] = useState(a && a.cut_day ? String(a.cut_day) : '');
  const [due, setDue] = useState(a && a.due_day ? String(a.due_day) : '');
  const [error, setError] = useState('');
  const credit = type === 'credit';

  const save = async () => {
    if (!name.trim()) { setError('Escribe un nombre para la cuenta.'); return; }
    if (last4 && last4.length !== 4) { setError('Los últimos dígitos deben ser 4.'); return; }
    if (credit && !dayOk(cut)) { setError('El día de corte debe ser entre 1 y 31.'); return; }
    if (credit && !dayOk(due)) { setError('El día de pago debe ser entre 1 y 31.'); return; }
    const row = {
      type, name: name.trim(), last4: type !== 'cash' && last4 ? last4 : null,
      opening_balance: parseFloat(opening) || 0,
      credit_limit: credit && parseFloat(limit) > 0 ? parseFloat(limit) : null,
      cut_day: credit && cut ? Number(cut) : null,
      due_day: credit && due ? Number(due) : null,
    };
    if (await onSave(row, a ? a.id : null)) onClose();
  };

  return (
    <TopSheet visible={visible} onClose={onClose} title={a ? 'Editar cuenta' : 'Nueva cuenta'} onSave={save}>
      <Segmented options={TYPE_OPTS} value={type} onChange={(k) => { setType(k); setError(''); }} style={{ marginTop: 12 }} />
      <TextInput style={s.input} placeholder={NAME_HINT[type]} placeholderTextColor={C.muted} value={name} onChangeText={(x) => { setName(x); setError(''); }} maxLength={40} autoFocus={!a} />
      {type !== 'cash' && (
        <TextInput style={s.input} placeholder="Últimos 4 dígitos (opcional)" placeholderTextColor={C.muted} value={last4} onChangeText={(x) => { setLast4(digits(x, 4)); setError(''); }} keyboardType="number-pad" maxLength={4} />
      )}
      <Text style={[s.balanceSub, { marginTop: 16 }]}>{credit ? '¿Cuánto debes hoy en esta tarjeta?' : '¿Cuánto tienes hoy en esta cuenta?'}</Text>
      <TextInput value={showAmount(opening)} onChangeText={(x) => setOpening(cleanAmount(x))} keyboardType="decimal-pad" placeholder="$0.00" placeholderTextColor={C.muted} style={s.amountInput} />
      {credit && (
        <>
          <TextInput value={limit ? 'Límite ' + showAmount(limit) : ''} onChangeText={(x) => setLimit(cleanAmount(x))} keyboardType="decimal-pad" placeholder="Límite de crédito (opcional)" placeholderTextColor={C.muted} style={s.input} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput value={cut} onChangeText={(x) => { setCut(digits(x, 2)); setError(''); }} keyboardType="number-pad" placeholder="Día de corte" placeholderTextColor={C.muted} style={[s.input, { flex: 1 }]} />
            <TextInput value={due} onChangeText={(x) => { setDue(digits(x, 2)); setError(''); }} keyboardType="number-pad" placeholder="Día límite de pago" placeholderTextColor={C.muted} style={[s.input, { flex: 1 }]} />
          </View>
        </>
      )}
      {!!error && <Text style={[s.hint, { color: C.red }]}>{error}</Text>}
      <Text style={[s.balanceSub, { marginTop: 12 }]}>
        {a ? 'El saldo es el que tenías al registrar la cuenta; los movimientos desde ese día se suman o restan solos.' : 'Desde hoy, los movimientos que registres con esta cuenta se suman o restan solos.'}
      </Text>
      {!!a && (
        <Pressable accessibilityRole="button" onPress={() => { onDelete(a.id); onClose(); }} style={{ marginTop: 18, marginBottom: 6 }}>
          <Text style={[s.link, { color: C.red, textAlign: 'center' }]}>Borrar cuenta (sus movimientos se conservan)</Text>
        </Pressable>
      )}
    </TopSheet>
  );
}
