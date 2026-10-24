import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { TopSheet } from '../components/TopSheet';
import { CATS } from '../constants/budget';
import { cleanAmount, showAmount } from '../lib/format';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

// Crear o editar el presupuesto mensual de una categoría. edit: { cat, amount } o null para uno nuevo.
// Quien la usa le pone un `key` distinto cada vez que se abre, así arranca con los valores de `edit`.
export function BudgetSheet({ visible, edit, limits, onClose, onSave }) {
  const [cat, setCat] = useState(edit ? edit.cat : null);
  const [amount, setAmount] = useState(edit && edit.amount ? String(edit.amount) : '');
  const save = async () => {
    const n = parseFloat(amount);
    if (!cat || !(n > 0)) return;
    await onSave(cat, n);
    onClose();
  };
  const remove = async () => { await onSave(edit.cat, null); onClose(); };
  const free = CATS.filter((c) => c.bucket !== 'savings' && (!limits[c.name] || (edit && edit.cat === c.name)));
  return (
    <TopSheet visible={visible} onClose={onClose} title={edit ? 'Presupuesto de ' + edit.cat : 'Nuevo presupuesto'} onSave={save}>
      {!edit && (
        <>
          <Text style={[s.sectionTitle, { marginLeft: 4, marginTop: 8 }]}>Categoría</Text>
          <View style={s.chipsRow}>
            {free.map((c) => (
              <Pressable key={c.name} onPress={() => setCat(c.name)} style={[s.chip, cat === c.name && { backgroundColor: C.primary }]}>
                <Text style={[s.chipText, cat === c.name && { color: '#fff' }]}>{c.icon} {c.name}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      <TextInput value={showAmount(amount)} onChangeText={(x) => setAmount(cleanAmount(x))} keyboardType="decimal-pad" placeholder="$0.00" style={s.amountInput} autoFocus={!!edit} />
      <Text style={[s.caption, { paddingHorizontal: 4, textAlign: 'center' }]}>Al mes. Te avisamos al llegar al 80% y al 100%.</Text>
      {!!edit && <Pressable onPress={remove} style={{ marginTop: 14 }}><Text style={[s.link, { color: C.red, textAlign: 'center' }]}>Quitar presupuesto</Text></Pressable>}
    </TopSheet>
  );
}
