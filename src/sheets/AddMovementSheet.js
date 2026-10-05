import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Modal, Platform, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Segmented } from '../components/ui';
import { BUCKETS, CATS, DAYS, DAY_ORDER, EFREQ } from '../constants/budget';
import { cleanAmount, showAmount } from '../lib/format';
import { s } from '../theme/styles';

export function AddMovementSheet({ visible, onClose, onAdd }) {
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState('Comida');
  const [freq, setFreq] = useState('once');
  const [wday, setWday] = useState(new Date().getDay());
  const [mday, setMday] = useState(new Date().getDate());
  const [kind, setKind] = useState('expense');
  const [note, setNote] = useState('');
  const [kb, setKb] = useState(false);
  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(show, () => setKb(true));
    const b = Keyboard.addListener(hide, () => setKb(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  const save = async () => {
    const n = parseFloat(amount);
    if (!(n > 0)) return;
    const row = kind === 'income'
      ? { kind, amount: n, note: note.trim() || 'Ingreso', occurred_at: new Date().toISOString() }
      : { kind, amount: n, cat, note: note.trim() || null, freq, day: freq === 'weekly' ? wday : freq === 'monthly' ? mday : null, occurred_at: new Date().toISOString() };
    if (await onAdd(row)) { setAmount(''); setNote(''); setFreq('once'); Keyboard.dismiss(); onClose(); }
  };
  // Toque en la zona gris: primero cierra el teclado; si ya está cerrado, cierra la hoja
  const tapOutside = () => (kb ? Keyboard.dismiss() : onClose());
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.sheetWrap}>
        <View style={[s.sheet, { paddingTop: insets.top + 12 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Pressable onPress={onClose}><Text style={s.link}>Cancelar</Text></Pressable>
            <Text style={[s.body, { fontWeight: '600' }]}>{kind === 'income' ? 'Nuevo ingreso' : 'Nuevo gasto'}</Text>
            <Pressable onPress={save}><Text style={[s.link, { fontWeight: '600' }]}>Guardar</Text></Pressable>
          </View>
          <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Segmented options={{ expense: { label: 'Gasto' }, income: { label: 'Ingreso' } }} value={kind} onChange={setKind} />
            <TextInput value={showAmount(amount)} onChangeText={(t) => setAmount(cleanAmount(t))} keyboardType="decimal-pad" placeholder="$0.00" autoFocus style={s.amountInput} />
            <TextInput style={[s.input, { marginTop: 0, marginBottom: 12 }]} placeholder={kind === 'income' ? 'Concepto (ej. Nómina, Freelance)' : 'Descripción (ej. Suscripción Spotify)'} value={note} onChangeText={setNote} maxLength={80} returnKeyType="done" />
            {kind === 'income' ? null : (<>
            <Text style={[s.sectionTitle, { marginLeft: 4, marginTop: 0 }]}>Categorías</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {CATS.map((c) => (
                <Pressable key={c.name} onPress={() => setCat(c.name)}
                  style={[s.chip, cat === c.name && { backgroundColor: BUCKETS[c.bucket].color }]}>
                  <Text style={[s.chipText, cat === c.name && { color: '#fff' }]}>{c.icon} {c.name}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[s.caption, { paddingHorizontal: 4 }]}>Cuenta como: {BUCKETS[CATS.find((c) => c.name === cat).bucket].label}</Text>

            <Text style={[s.sectionTitle, { marginLeft: 4, marginTop: 16 }]}>Frecuencia</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {Object.entries(EFREQ).map(([k, l]) => (
                <Pressable key={k} onPress={() => setFreq(k)} style={[s.chip, freq === k && { backgroundColor: '#007AFF' }]}>
                  <Text style={[s.chipText, freq === k && { color: '#fff' }]}>{l}</Text>
                </Pressable>
              ))}
            </View>
            {freq === 'weekly' && (
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                {DAY_ORDER.map((d) => (
                  <Pressable key={d} onPress={() => setWday(d)} style={[s.dayChip, wday === d && { backgroundColor: '#007AFF' }]}>
                    <Text style={[s.chipText, { fontSize: 13 }, wday === d && { color: '#fff' }]}>{DAYS[d]}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {freq === 'monthly' && (
              <View style={s.stepper}>
                <Text style={s.body}>Se cobra el día</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Pressable style={s.stepBtn} onPress={() => setMday(mday <= 1 ? 31 : mday - 1)}><Text style={s.stepText}>−</Text></Pressable>
                  <Text style={[s.body, { width: 36, textAlign: 'center', fontWeight: '600' }]}>{mday}</Text>
                  <Pressable style={s.stepBtn} onPress={() => setMday(mday >= 31 ? 1 : mday + 1)}><Text style={s.stepText}>+</Text></Pressable>
                </View>
              </View>
            )}
            {freq !== 'once' && <Text style={[s.caption, { paddingHorizontal: 4, marginTop: 8 }]}>Se cuenta en tu presupuesto cada vez que toque, desde hoy.</Text>}
            </>)}
          </ScrollView>
        </View>
        <Pressable style={{ flex: 1 }} onPress={tapOutside} />
      </View>
    </Modal>
  );
}
