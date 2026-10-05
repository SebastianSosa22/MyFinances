import React, { useState, useEffect } from 'react';
import { Text, TextInput, Keyboard } from 'react-native';
import { TopSheet } from '../components/TopSheet';
import { cleanAmount, showAmount } from '../lib/format';
import { s } from '../theme/styles';

export function ContributeSheet({ goal, onClose, onSubmit }) {
  const [amount, setAmount] = useState('');
  useEffect(() => { setAmount(''); }, [goal]);
  const save = async () => { const n = parseFloat(amount); if (n > 0 && (await onSubmit(goal, n))) { Keyboard.dismiss(); onClose(); } };
  return (
    <TopSheet visible={!!goal} onClose={onClose} title={goal ? 'Aportar a ' + goal.name : ''} onSave={save} saveLabel="Aportar">
      <TextInput value={showAmount(amount)} onChangeText={(x) => setAmount(cleanAmount(x))} keyboardType="decimal-pad" placeholder="$0.00" autoFocus style={s.amountInput} />
      <Text style={[s.caption, { paddingHorizontal: 4 }]}>El aporte cuenta como gasto de Ahorro (tu 20%).</Text>
    </TopSheet>
  );
}
