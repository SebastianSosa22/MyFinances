import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Platform } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { Segmented } from '../components/ui';
import { money } from '../lib/format';
import { ME, MAX_PEOPLE, NAME_MAX, SPLIT_MODES, computeShares, splitError } from '../lib/shared';
import { C } from '../theme/colors';
import { MONO, s } from '../theme/styles';

const AVATAR = ['#6EA8FF', '#FFB25B', '#C79BFF', '#FF8A8A', '#5ED3E6', '#F2D16B'];
// Círculo con la inicial de la persona (tú en menta; los demás con un color fijo según su nombre)
export function Avatar({ name, size = 36 }) {
  const me = name === ME;
  const color = me ? C.primary : AVATAR[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVATAR.length];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.onPrimary, fontWeight: '700', fontSize: size * 0.38 }}>{me ? 'Tú' : name.trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const round2 = (x) => Math.round(x * 100) / 100;
const cleanNum = (t) => t.replace(',', '.').replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 10);

// Valores iniciales al cambiar de forma de dividir: porcentajes o montos iguales, para que siempre arranque sumando bien
function defaults(mode, names, total) {
  if (mode === 'percent') {
    const base = Math.floor(100 / names.length), extra = 100 - base * names.length;
    return Object.fromEntries(names.map((n, i) => [n, String(base + (i < extra ? 1 : 0))]));
  }
  if (mode === 'amount') return Object.fromEntries(computeShares(total, names, 'equal').map((x) => [x.name, String(x.share)]));
  return {};
}

// Hoja "Dividir gasto": con quién, quién pagó y cómo se divide (iguales, porcentaje o montos).
// value: { names: ['Tú', ...], payer, mode, values } o null. onApply(value) guarda; onApply(null) quita la división.
export function SplitSheet({ visible, total, value, known = [], onApply, onClose }) {
  const [names, setNames] = useState(value ? value.names : [ME]);
  const [payer, setPayer] = useState(value ? value.payer : ME);
  const [mode, setMode] = useState(value ? value.mode : 'equal');
  const [values, setValues] = useState(value ? value.values : {});
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const options = [...new Set([...names.slice(1), ...known])].filter((n) => n !== ME);
  const others = names.slice(1);
  const shares = computeShares(total, names, mode, values);
  const problem = total > 0 ? splitError(total, shares, mode) : '';
  const restyle = (nextNames, nextMode = mode) => { setValues(defaults(nextMode, nextNames, total)); };

  const toggle = (name) => {
    const next = names.includes(name) ? names.filter((n) => n !== name) : [...names, name].slice(0, MAX_PEOPLE + 1);
    setNames(next);
    if (!next.includes(payer)) setPayer(ME);
    restyle(next);
  };
  const add = () => {
    const name = draft.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX);
    setDraft(''); setAdding(false);
    if (!name || name.toLowerCase() === ME.toLowerCase() || name.toLowerCase() === 'yo') return;
    const existing = options.find((n) => n.toLowerCase() === name.toLowerCase());
    if (existing && names.includes(existing)) return;
    toggle(existing || name);
  };
  const pickMode = (k) => { setMode(k); restyle(names, k); };
  const setVal = (name, t) => setValues((v) => ({ ...v, [name]: cleanNum(t) }));

  const note = (name) => {
    if (name === payer) return payer === ME ? 'pagaste' : 'pagó';
    if (payer === ME) return 'te debe';
    if (name === ME) return 'le debes a ' + payer;
    return '';
  };
  const sumAmt = round2(shares.reduce((a, x) => a + x.share, 0));
  const ok = !problem && others.length > 0 && total > 0;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Dividir gasto" subtitle={total > 0 ? 'Total ' + money(total) + '. En tu presupuesto solo cuenta tu parte.' : 'Escribe primero el monto total del gasto.'}>
      <ScrollView style={{ maxHeight: 560 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 4 }}>
        <View style={{ gap: 8 }}>
          <Text style={s.eyebrow}>¿Con quién?</Text>
          <View style={s.wrapRow}>
            <View style={[s.catChip, s.catChipOn]}><Text style={[s.catChipText, { fontWeight: '600' }]}>{ME}</Text></View>
            {options.map((n) => {
              const on = names.includes(n);
              return (
                <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} key={n} onPress={() => toggle(n)} style={[s.catChip, on && s.catChipOn]}>
                  <Text style={[s.catChipText, on && { fontWeight: '600' }]} numberOfLines={1}>{n}</Text>
                </Pressable>
              );
            })}
            {!adding && names.length <= MAX_PEOPLE && (
              <Pressable accessibilityRole="button" onPress={() => setAdding(true)} style={[s.catChip, s.catChipMore]}><Text style={[s.catChipText, { color: C.link }]}>+ Agregar</Text></Pressable>
            )}
          </View>
          {adding && (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TextInput autoFocus value={draft} onChangeText={setDraft} onSubmitEditing={add} returnKeyType="done" maxLength={NAME_MAX} placeholder="Nombre (ej. Ana, Pareja)" placeholderTextColor="#5D6A80"
                style={[s.input, { flex: 1, marginTop: 0, paddingVertical: 10 }]} accessibilityLabel="Nombre de la persona" />
              <Pressable accessibilityRole="button" onPress={add} style={[s.catChip, s.catChipOn, { height: 44 }]}><Text style={[s.catChipText, { fontWeight: '600' }]}>Agregar</Text></Pressable>
            </View>
          )}
          {options.length === 0 && !adding && <Text style={s.smallMuted}>Agrega a las personas por su nombre. No necesitan tener la app.</Text>}
        </View>

        {others.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={s.eyebrow}>¿Quién pagó?</Text>
            <View style={s.wrapRow}>
              {[ME, ...others].map((n) => {
                const on = payer === n;
                return (
                  <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} key={n} onPress={() => setPayer(n)} style={[s.catChip, on && s.repeatOptOn]}>
                    <Text style={[s.catChipText, on && { color: C.onPrimary, fontWeight: '700' }]} numberOfLines={1}>{n === ME ? 'Yo pagué' : n}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {others.length > 0 && (
          <View style={{ gap: 4 }}>
            <Text style={s.eyebrow}>¿Cómo se divide?</Text>
            <Segmented options={SPLIT_MODES} value={mode} onChange={pickMode} style={{ marginTop: 6 }} />
            {shares.map((x, i) => {
              const tag = note(x.name);
              const owes = (payer === ME && x.name !== ME) || (payer !== ME && x.name === ME);
              return (
                <View key={x.name} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }, i > 0 && s.sep]}>
                  <Avatar name={x.name} />
                  <Text style={[s.body, { flex: 1, minWidth: 0, fontSize: 16 }]} numberOfLines={1}>{x.name}{!!tag && <Text style={s.smallMuted}>{'  ' + tag}</Text>}</Text>
                  {mode !== 'equal' && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.raised, borderRadius: 10, paddingHorizontal: 10, height: 36, width: mode === 'amount' ? 120 : 84 }}>
                      {mode === 'amount' && <Text style={{ fontFamily: MONO, color: C.muted, fontSize: 15 }}>$</Text>}
                      <TextInput value={values[x.name] || ''} onChangeText={(t) => setVal(x.name, t)} keyboardType="decimal-pad" inputMode="decimal" placeholder="0" placeholderTextColor="#5D6A80"
                        style={{ flex: 1, width: '100%', fontFamily: MONO, color: C.text, fontSize: 15, textAlign: 'right', minWidth: 0, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) }} accessibilityLabel={(mode === 'percent' ? 'Porcentaje de ' : 'Monto de ') + x.name} />
                      {mode === 'percent' && <Text style={{ fontFamily: MONO, color: C.muted, fontSize: 15 }}> %</Text>}
                    </View>
                  )}
                  {mode !== 'amount' && <Text style={[s.rowAmount, { minWidth: 76, textAlign: 'right' }, owes && { color: payer === ME ? C.green : C.orange }]}>{money(x.share)}</Text>}
                </View>
              );
            })}
            {mode !== 'equal' && total > 0 && (
              <Text style={[s.smallMuted, { textAlign: 'center', color: problem ? C.red : C.green }]}>
                {problem || (mode === 'percent' ? '✓ Suma 100 % · ' + money(total) : '✓ Suma ' + money(sumAmt))}
              </Text>
            )}
          </View>
        )}

        <Pressable accessibilityRole="button" disabled={!ok} style={[s.saveBtn, { marginTop: 0 }, ok && { backgroundColor: C.primary }]} onPress={() => onApply({ names, payer, mode, values })}>
          <Text style={[s.saveBtnText, !ok && { color: C.muted }]}>{others.length === 0 ? 'Elige con quién' : 'Listo'}</Text>
        </Pressable>
        {!!value && <Pressable accessibilityRole="button" onPress={() => onApply(null)}><Text style={[s.link, { textAlign: 'center', color: C.red }]}>No dividir este gasto</Text></Pressable>}
      </ScrollView>
    </BottomSheet>
  );
}

// Lo elegido en la hoja a partir del `split` guardado en un movimiento (para editarlo)
export function draftFromSplit(m) {
  const sp = m.split;
  const names = [ME, ...sp.people.map((p) => p.name)];
  if (sp.payer && sp.payer !== ME && !names.includes(sp.payer)) names.push(sp.payer);
  let values = {};
  if (sp.mode === 'percent') values = { [ME]: String(sp.my_pct ?? ''), ...Object.fromEntries(sp.people.map((p) => [p.name, String(p.pct ?? '')])) };
  if (sp.mode === 'amount') values = { [ME]: String(m.amount), ...Object.fromEntries(sp.people.map((p) => [p.name, String(p.share)])) };
  return { names, payer: sp.payer || ME, mode: sp.mode || 'equal', values };
}
