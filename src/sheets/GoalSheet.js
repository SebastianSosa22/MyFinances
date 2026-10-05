import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { TopSheet } from '../components/TopSheet';
import { cleanAmount, isoLocal, showAmount } from '../lib/format';
import { s } from '../theme/styles';

export function GoalSheet({ visible, goal, onClose, onSave }) {
  const [name, setName] = useState(''), [target, setTarget] = useState(''), [dl, setDl] = useState('none');
  useEffect(() => {
    if (visible) { setName(goal ? goal.name : ''); setTarget(goal ? String(goal.target) : ''); setDl(goal && goal.deadline ? 'keep' : 'none'); }
  }, [visible, goal]);
  const opts = { none: 'Sin fecha', 3: '3 meses', 6: '6 meses', 12: '1 año', 24: '2 años' };
  if (goal && goal.deadline) opts.keep = 'Actual (' + goal.deadline + ')';
  const save = async () => {
    const n = parseFloat(target);
    if (!name.trim() || !(n > 0)) return;
    let deadline = null;
    if (dl === 'keep') deadline = goal.deadline;
    else if (dl !== 'none') { const d = new Date(); d.setMonth(d.getMonth() + Number(dl)); deadline = isoLocal(d); }
    if (await onSave({ name: name.trim(), target: n, deadline }, goal ? goal.id : null)) onClose();
  };
  return (
    <TopSheet visible={visible} onClose={onClose} title={goal ? 'Editar meta' : 'Nueva meta'} onSave={save}>
      <TextInput style={[s.input, { marginBottom: 4 }]} placeholder="Nombre (ej. Viaje, Fondo de emergencia)" value={name} onChangeText={setName} maxLength={60} autoFocus={!goal} />
      <TextInput value={showAmount(target)} onChangeText={(x) => setTarget(cleanAmount(x))} keyboardType="decimal-pad" placeholder="$0.00" style={s.amountInput} />
      <Text style={[s.sectionTitle, { marginLeft: 4, marginTop: 0 }]}>Fecha objetivo</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {Object.entries(opts).map(([k, l]) => (
          <Pressable key={k} onPress={() => setDl(k)} style={[s.chip, dl === k && { backgroundColor: '#007AFF' }]}><Text style={[s.chipText, dl === k && { color: '#fff' }]}>{l}</Text></Pressable>
        ))}
      </View>
    </TopSheet>
  );
}
