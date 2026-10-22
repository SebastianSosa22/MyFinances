import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput } from 'react-native';
import { Segmented } from './ui';
import { CYCLES, DAYS, DAY_ORDER, DEFAULT_SPLIT, SPLITS } from '../constants/budget';
import { cleanAmount, showAmount } from '../lib/format';
import { s } from '../theme/styles';

// Asistente de bienvenida: cada persona cuenta cómo cobra y la app se adapta (ciclo, día de cobro, ingreso y reparto)
export function Onboarding({ visible, onDone, onSkip }) {
  const [cycle, setCycle] = useState('weekly');
  const [payDay, setPayDay] = useState(5);
  const [mday, setMday] = useState(15);
  const [amount, setAmount] = useState('');
  const [split, setSplit] = useState(DEFAULT_SPLIT);
  const n = parseFloat(amount);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onSkip}>
      <View style={s.noticeOverlay}>
        <View style={s.noticeCard}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={s.noticeTitle}>Vamos a configurar tu app 👋</Text>
            <Text style={[s.body, { fontSize: 15, marginTop: 8 }]}>Cuéntanos cómo cobras para calcular cuánto puedes gastar y cuánto ahorras. Lo puedes cambiar después en Ajustes.</Text>

            <Text style={[s.body, { fontWeight: '600', marginTop: 18 }]}>¿Cada cuánto cobras?</Text>
            <Segmented options={CYCLES} value={cycle} onChange={setCycle} />

            {cycle === 'weekly' && (
              <>
                <Text style={[s.body, { fontWeight: '600', marginTop: 16 }]}>¿Qué día cobras?</Text>
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  {DAY_ORDER.map((d) => (
                    <Pressable key={d} onPress={() => setPayDay(d)} style={[s.dayChip, payDay === d && { backgroundColor: '#007AFF' }]}>
                      <Text style={[s.chipText, { fontSize: 13 }, payDay === d && { color: '#fff' }]}>{DAYS[d]}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {cycle === 'monthly' && (
              <View style={s.stepper}>
                <Text style={s.body}>Cobras el día</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Pressable style={s.stepBtn} onPress={() => setMday(mday <= 1 ? 31 : mday - 1)}><Text style={s.stepText}>−</Text></Pressable>
                  <Text style={[s.body, { width: 36, textAlign: 'center', fontWeight: '600' }]}>{mday}</Text>
                  <Pressable style={s.stepBtn} onPress={() => setMday(mday >= 31 ? 1 : mday + 1)}><Text style={s.stepText}>+</Text></Pressable>
                </View>
              </View>
            )}
            {cycle === 'biweekly' && <Text style={[s.caption, { paddingHorizontal: 0, marginTop: 8 }]}>Se toman las quincenas del 1 al 15 y del 16 al fin de mes (cobro los días 15 y 30).</Text>}

            <Text style={[s.body, { fontWeight: '600', marginTop: 16 }]}>¿Cuánto cobras {cycle === 'weekly' ? 'cada semana' : cycle === 'biweekly' ? 'cada quincena' : 'al mes'}?</Text>
            <TextInput value={showAmount(amount)} onChangeText={(x) => setAmount(cleanAmount(x))} keyboardType="decimal-pad" placeholder="$0.00" style={s.amountInput} />
            <Text style={[s.caption, { paddingHorizontal: 0 }]}>Es opcional: si lo dejas vacío, registras tus ingresos a mano.</Text>

            <Text style={[s.body, { fontWeight: '600', marginTop: 16 }]}>¿Cómo quieres repartir tus ingresos?</Text>
            <Segmented options={SPLITS} value={split} onChange={setSplit} />
            <Text style={[s.caption, { paddingHorizontal: 0, marginTop: 6 }]}>{SPLITS[split].hint} Necesidades / Deseos / Ahorro.</Text>
          </ScrollView>
          <Pressable style={s.button} onPress={() => onDone({ cycle, payDay, mday, split, amount: n > 0 ? n : 0 })}><Text style={s.buttonText}>Empezar</Text></Pressable>
          <Pressable onPress={onSkip}><Text style={[s.link, { textAlign: 'center', marginTop: 14, fontSize: 15 }]}>Omitir por ahora</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}
