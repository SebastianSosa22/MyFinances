import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Modal, Platform, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Segmented } from '../components/ui';
import { BUCKETS, CATS, DAYS, DAY_ORDER, EFREQ, INCOME_FREQ } from '../constants/budget';
import { DAY_MS, midnight } from '../lib/dates';
import { parseDay } from '../lib/finance';
import { cleanAmount, isoLocal, money, showAmount } from '../lib/format';
import { suggestFromNote } from '../lib/insights';
import { s } from '../theme/styles';
import { DismissKeyboard } from '../components/DismissKeyboard';

// Selector de frecuencia (y del día cuando es semanal o mensual); sirve para gastos e ingresos
function FreqPicker({ options, freq, setFreq, wday, setWday, mday, setMday }) {
  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {Object.entries(options).map(([k, l]) => (
          <Pressable key={k} onPress={() => setFreq(k)} style={[s.chip, freq === k && { backgroundColor: '#2D8A4E' }]}>
            <Text style={[s.chipText, freq === k && { color: '#fff' }]}>{l}</Text>
          </Pressable>
        ))}
      </View>
      {freq === 'weekly' && (
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          {DAY_ORDER.map((d) => (
            <Pressable key={d} onPress={() => setWday(d)} style={[s.dayChip, wday === d && { backgroundColor: '#2D8A4E' }]}>
              <Text style={[s.chipText, { fontSize: 13 }, wday === d && { color: '#fff' }]}>{DAYS[d]}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {freq === 'monthly' && (
        <View style={s.stepper}>
          <Text style={s.body}>Se repite el día</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable style={s.stepBtn} onPress={() => setMday(mday <= 1 ? 31 : mday - 1)}><Text style={s.stepText}>−</Text></Pressable>
            <Text style={[s.body, { width: 36, textAlign: 'center', fontWeight: '600' }]}>{mday}</Text>
            <Pressable style={s.stepBtn} onPress={() => setMday(mday >= 31 ? 1 : mday + 1)}><Text style={s.stepText}>+</Text></Pressable>
          </View>
        </View>
      )}
    </>
  );
}

// Hoja para registrar un movimiento nuevo o editar uno existente (edit)
export function AddMovementSheet({ visible, onClose, onAdd, onUpdate, onDelete, edit, moves }) {
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState('Comida');
  const [freq, setFreq] = useState('once');
  const [wday, setWday] = useState(new Date().getDay());
  const [mday, setMday] = useState(new Date().getDate());
  const [kind, setKind] = useState('expense');
  const [note, setNote] = useState('');
  const [daysAgo, setDaysAgo] = useState(0);
  const [touchedDate, setTouchedDate] = useState(false);
  const [error, setError] = useState('');
  const [kb, setKb] = useState(false);

  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(show, () => setKb(true));
    const b = Keyboard.addListener(hide, () => setKb(false));
    return () => { a.remove(); b.remove(); };
  }, []);

  // Cada vez que se abre: vacía (nuevo) o con los datos del movimiento (editar)
  useEffect(() => {
    if (!visible) return;
    const now = new Date();
    setError(''); setTouchedDate(false);
    if (edit) {
      const d = new Date(edit.occurred_at);
      setKind(edit.kind); setAmount(String(edit.amount)); setNote(edit.note || ''); setCat(edit.cat || 'Comida');
      setFreq(edit.freq || 'once'); setWday(edit.freq === 'weekly' && edit.day != null ? edit.day : d.getDay());
      setMday(edit.freq === 'monthly' && edit.day != null ? edit.day : d.getDate());
      setDaysAgo(Math.max(Math.round((midnight(now) - midnight(d)) / DAY_MS), 0));
    } else {
      setKind('expense'); setAmount(''); setNote(''); setCat('Comida'); setFreq('once');
      setWday(now.getDay()); setMday(now.getDate()); setDaysAgo(0);
    }
  }, [visible, edit]);

  const isIncome = kind === 'income';
  const suggestion = useMemo(() => (!edit && !isIncome ? suggestFromNote(moves || [], note) : null), [note, edit, isIncome, moves]);
  const sugCat = suggestion ? CATS.find((c) => c.name === suggestion.cat) : null;

  const when = () => {
    if (edit && !touchedDate) return edit.occurred_at;
    const d = new Date();
    if (daysAgo > 0) { d.setDate(d.getDate() - daysAgo); d.setHours(12, 0, 0, 0); }
    return d.toISOString();
  };
  const dateLabel = () => {
    if (daysAgo === 0) return 'Hoy';
    if (daysAgo === 1) return 'Ayer';
    const d = new Date(); d.setDate(d.getDate() - daysAgo);
    return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
  };
  const moveDate = (delta) => { setTouchedDate(true); setDaysAgo(Math.max(daysAgo + delta, 0)); };

  const save = async () => {
    const n = parseFloat(amount);
    if (!(n > 0)) { setError('Escribe un monto mayor a $0.'); return; }
    const day = freq === 'weekly' ? wday : freq === 'monthly' ? mday : null;
    const common = { amount: n, freq, day, occurred_at: when() };
    const patch = isIncome
      ? { ...common, note: note.trim() || 'Ingreso' }
      : { ...common, cat, note: note.trim() || null };
    if (freq === 'once') patch.ends_at = null;
    if (edit) { if (await onUpdate(edit.id, patch)) onClose(); return; }
    if (await onAdd({ kind, ...patch })) { Keyboard.dismiss(); onClose(); }
  };

  const endIt = async () => { if (await onUpdate(edit.id, { ends_at: isoLocal(new Date()) })) onClose(); };
  const reactivate = async () => { if (await onUpdate(edit.id, { ends_at: null })) onClose(); };
  const remove = () => { onDelete(edit.id); onClose(); };

  // Toque en la zona gris: primero cierra el teclado; si ya está cerrado, cierra la hoja
  const tapOutside = () => (kb ? Keyboard.dismiss() : onClose());
  const title = (edit ? 'Editar ' : 'Nuevo ') + (isIncome ? 'ingreso' : 'gasto');
  const recurring = freq !== 'once';

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.sheetWrap}>
        <DismissKeyboard style={[s.sheet, { paddingTop: insets.top + 12 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Pressable onPress={onClose}><Text style={s.link}>Cancelar</Text></Pressable>
            <Text style={[s.body, { fontWeight: '600' }]}>{title}</Text>
            <Pressable onPress={save}><Text style={[s.link, { fontWeight: '600' }]}>Guardar</Text></Pressable>
          </View>
          <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {!edit && <Segmented options={{ expense: { label: 'Gasto' }, income: { label: 'Ingreso' } }} value={kind} onChange={setKind} />}
            <TextInput value={showAmount(amount)} onChangeText={(t) => { setAmount(cleanAmount(t)); setError(''); }} keyboardType="decimal-pad" placeholder="$0.00" autoFocus={!edit} style={s.amountInput} />
            {!!error && <Text style={[s.hint, { color: '#F87171', marginTop: 0, marginBottom: 8 }]}>{error}</Text>}
            <TextInput style={[s.input, { marginTop: 0, marginBottom: 8 }]} placeholder={isIncome ? 'Concepto (ej. Nómina, Freelance)' : 'Descripción (ej. Suscripción Spotify)'} value={note} onChangeText={setNote} maxLength={80} returnKeyType="done" />
            {!!suggestion && (suggestion.cat !== cat || (suggestion.amount && !amount)) && (
              <Pressable onPress={() => { setCat(suggestion.cat); if (!amount && suggestion.amount) setAmount(String(suggestion.amount)); }} style={[s.chip, { alignSelf: 'flex-start', marginLeft: 0, backgroundColor: '#EAF2FF' }]}>
                <Text style={[s.chipText, { color: '#2D8A4E' }]}>
                  💡 {sugCat ? sugCat.icon : ''} {suggestion.cat}{suggestion.amount ? ' · ' + money(suggestion.amount) : ''} {suggestion.source === 'historial' ? '(como la última vez)' : ''}
                </Text>
              </Pressable>
            )}

            {isIncome ? (
              <>
                <Text style={[s.sectionTitle, { marginLeft: 4, marginTop: 12 }]}>Frecuencia</Text>
                <FreqPicker options={INCOME_FREQ} freq={freq} setFreq={setFreq} wday={wday} setWday={setWday} mday={mday} setMday={setMday} />
                {recurring && <Text style={[s.caption, { paddingHorizontal: 4, marginTop: 8 }]}>Se cuenta como ingreso cada vez que toque (ideal para tu nómina).</Text>}
              </>
            ) : (
              <>
                <Text style={[s.sectionTitle, { marginLeft: 4, marginTop: 8 }]}>Categorías</Text>
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
                <FreqPicker options={EFREQ} freq={freq} setFreq={setFreq} wday={wday} setWday={setWday} mday={mday} setMday={setMday} />
                {recurring && <Text style={[s.caption, { paddingHorizontal: 4, marginTop: 8 }]}>Se cuenta en tu presupuesto cada vez que toque, desde la fecha de inicio.</Text>}
              </>
            )}

            <View style={s.stepper}>
              <Text style={s.body}>{recurring ? 'Empieza' : 'Fecha'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Pressable style={s.stepBtn} onPress={() => moveDate(1)}><Text style={s.stepText}>‹</Text></Pressable>
                <Text style={[s.body, { minWidth: 110, textAlign: 'center', fontWeight: '600' }]}>{dateLabel()}</Text>
                <Pressable style={[s.stepBtn, daysAgo === 0 && { opacity: 0.3 }]} disabled={daysAgo === 0} onPress={() => moveDate(-1)}><Text style={s.stepText}>›</Text></Pressable>
              </View>
            </View>

            {!!edit && edit.freq !== 'once' && (
              edit.ends_at ? (
                <View style={{ marginTop: 16 }}>
                  <Text style={[s.caption, { paddingHorizontal: 4 }]}>Terminó el {parseDay(edit.ends_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}. Su historial se conserva.</Text>
                  <Pressable onPress={reactivate}><Text style={[s.link, { marginTop: 8, marginLeft: 4 }]}>Reactivar</Text></Pressable>
                </View>
              ) : (
                <View style={{ marginTop: 16 }}>
                  <Pressable onPress={endIt}><Text style={[s.link, { marginLeft: 4 }]}>{isIncome ? 'Terminar este ingreso' : 'Terminar este pago'}</Text></Pressable>
                  <Text style={[s.caption, { paddingHorizontal: 4 }]}>Deja de contarse desde hoy y no se pierde lo que ya pasó. Así no se altera tu historial.</Text>
                </View>
              )
            )}
            {!!edit && <Pressable onPress={remove}><Text style={[s.link, { color: '#F87171', marginTop: 16, marginLeft: 4, marginBottom: 8 }]}>Borrar movimiento</Text></Pressable>}
          </ScrollView>
        </DismissKeyboard>
        <Pressable style={{ flex: 1 }} onPress={tapOutside} />
      </View>
    </Modal>
  );
}
