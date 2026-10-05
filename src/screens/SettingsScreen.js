import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Switch } from 'react-native';
import { Card, Segmented, Title } from '../components/ui';
import { CATS } from '../constants/budget';
import { useWide } from '../hooks/useWide';
import { startOfMonth } from '../lib/dates';
import { report } from '../lib/finance';
import { cleanAmount, money, showAmount } from '../lib/format';
import { supabase } from '../lib/supabase';
import { s } from '../theme/styles';

export function SettingsScreen({ session, moves, limits, rem, setReminders, onSaveLimit }) {
  const wide = useWide();
  const now = new Date();
  const monthByCat = report(moves, startOfMonth(now), now).byCat;

  const remB = (<>
    <Title>Recordatorios</Title>
    <Card>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <Text style={[s.body, { flex: 1, marginRight: 12 }]}>Avisarme de mis pagos recurrentes</Text>
        <Switch value={rem.on} onValueChange={(v) => setReminders({ ...rem, on: v })} />
      </View>
      {rem.on && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <Segmented options={{ 0: { label: 'Mismo día' }, 1: { label: '1 día antes' }, 3: { label: '3 días antes' } }} value={String(rem.before)} onChange={(k) => setReminders({ ...rem, before: Number(k) })} />
          <Segmented options={{ 8: { label: '8:00' }, 9: { label: '9:00' }, 12: { label: '12:00' }, 18: { label: '18:00' } }} value={String(rem.hour)} onChange={(k) => setReminders({ ...rem, hour: Number(k) })} />
        </View>
      )}
      <View style={[s.row, s.sep, { justifyContent: 'space-between' }]}>
        <Text style={[s.body, { flex: 1, marginRight: 12 }]}>Recordarme registrar mis gastos (9 pm)</Text>
        <Switch value={rem.daily} onValueChange={(v) => setReminders({ ...rem, daily: v })} />
      </View>
    </Card>
    <Text style={s.hint}>Las notificaciones se programan en este teléfono y se actualizan cada vez que abres la app.</Text>

  </>);
  const limB = (<>
    <Title>Límites mensuales por categoría</Title>
    <Card>
      {CATS.filter((c) => c.bucket !== 'savings').map((c, i) => (
        <LimitRow key={c.name} first={i === 0} icon={c.icon} cat={c.name} value={limits[c.name]} spent={monthByCat[c.name] || 0} onSave={onSaveLimit} />
      ))}
    </Card>
    <Text style={s.hint}>Déjalo vacío si no quieres límite. Te avisamos en el Resumen y al registrar un gasto cuando llegues al 80% y al 100%.</Text>

  </>);
  const accB = (<>
    <Title>Cuenta</Title>
    <Card style={{ padding: 16 }}>
      <Text style={s.body}>{session.user.email}</Text>
      <Pressable onPress={() => supabase.auth.signOut()}><Text style={[s.link, { color: '#FF3B30', marginTop: 12 }]}>Cerrar sesión</Text></Pressable>
    </Card>
  </>);
  return (
    <>
      <Text style={s.largeTitle}>Ajustes</Text>
      {wide ? (
        <View style={s.cols}><View style={s.col}>{remB}{accB}</View><View style={s.col}>{limB}</View></View>
      ) : (<>{remB}{limB}{accB}</>)}
    </>
  );
}

export function LimitRow({ cat, icon, value, spent, onSave, first }) {
  const [v, setV] = useState(value ? String(value) : '');
  useEffect(() => { setV(value ? String(value) : ''); }, [value]);
  return (
    <View style={[s.row, !first && s.sep]}>
      <Text style={{ fontSize: 22, marginRight: 12 }}>{icon}</Text>
      <View style={{ flex: 1 }}><Text style={s.body}>{cat}</Text><Text style={[s.caption, { paddingHorizontal: 0 }]}>Este mes: {money(spent)}</Text></View>
      <TextInput style={s.limitInput} keyboardType="decimal-pad" placeholder="Sin límite" value={showAmount(v)} onChangeText={(x) => setV(cleanAmount(x))} onEndEditing={() => onSave(cat, parseFloat(v) || null)} />
    </View>
  );
}
