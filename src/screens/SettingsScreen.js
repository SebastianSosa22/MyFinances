import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Switch, Platform } from 'react-native';
import { Card, Segmented, Title } from '../components/ui';
import { BUCKETS, CATS, CYCLES, DAYS, DAY_ORDER, SPLITS } from '../constants/budget';
import { useWide } from '../hooks/useWide';
import { startOfMonth } from '../lib/dates';
import { exportMovesCsv } from '../lib/exportCsv';
import { report } from '../lib/finance';
import { cleanAmount, money, showAmount } from '../lib/format';
import { suggestLimits } from '../lib/insights';
import { signOutLocal } from '../lib/session';
import { s } from '../theme/styles';
import { PushCard } from '../components/PushCard';
import { IDLE_OPTIONS } from '../constants/security';

export function SettingsScreen({ session, moves, limits, settings, onSaveSettings, push, idle, rem, setReminders, onSaveLimit, onApplyLimits }) {
  const wide = useWide();
  const now = new Date();
  const monthByCat = report(moves, startOfMonth(now), now).byCat;
  const [limMsg, setLimMsg] = useState('');
  const [exportMsg, setExportMsg] = useState('');

  // Límites sugeridos con TU historial (solo en categorías que aún no tienen límite)
  const suggest = async () => {
    const all = suggestLimits(moves);
    const fresh = Object.fromEntries(Object.entries(all).filter(([cat]) => !limits[cat]));
    const n = Object.keys(fresh).length;
    if (!Object.keys(all).length) { setLimMsg('Aún no hay suficiente historial: registra al menos un mes completo de gastos.'); return; }
    if (!n) { setLimMsg('Ya tienes límite en todas las categorías con historial.'); return; }
    if (await onApplyLimits(fresh)) setLimMsg('Listo: pusimos ' + n + ' límites según tus últimos meses (tu promedio + 10%). Puedes cambiarlos cuando quieras.');
  };

  const exportCsv = async () => {
    setExportMsg('');
    try { await exportMovesCsv(moves); } catch (e) { setExportMsg('No se pudo exportar: ' + (e instanceof Error ? e.message : String(e))); }
  };

  const remB = (<>
    {Platform.OS === 'web' && <PushCard push={push} />}
    <Title>Caja de ahorro</Title>
    <Card style={{ padding: 16 }}>
      <Text style={s.body}>Cada cuánto recibes tu ingreso</Text>
      <Segmented options={CYCLES} value={settings.cycle} onChange={(k) => onSaveSettings({ cycle: k })} />
      {settings.cycle === 'weekly' && (
        <>
          <Text style={[s.body, { marginTop: 16 }]}>Día en que cobras</Text>
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            {DAY_ORDER.map((d) => (
              <Pressable key={d} onPress={() => onSaveSettings({ payDay: d })} style={[s.dayChip, settings.payDay === d && { backgroundColor: '#2D8A4E' }]}>
                <Text style={[s.chipText, { fontSize: 13 }, settings.payDay === d && { color: '#fff' }]}>{DAYS[d]}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[s.caption, { paddingHorizontal: 0, marginTop: 6 }]}>Tu semana y el cierre de tu caja empiezan ese día.</Text>
        </>
      )}
      <Text style={[s.body, { marginTop: 16 }]}>Apartar al recibir un ingreso</Text>
      <Segmented options={{ 0: { label: '0%' }, 10: { label: '10%' }, 20: { label: '20%' }, 30: { label: '30%' } }} value={String(settings.reservePct)} onChange={(k) => onSaveSettings({ reservePct: Number(k) })} />
    </Card>
    <Text style={s.hint}>Al cerrar cada ciclo, lo que no gastaste pasa solo a tu caja de ahorro. Si apartas un porcentaje, esa parte de cada ingreso ya cuenta como ahorrada desde el inicio y no aparece como disponible.</Text>

    <Title>Reparto de tu presupuesto</Title>
    <Card style={{ padding: 16 }}>
      <Text style={s.body}>¿Cómo repartes tus ingresos?</Text>
      <Segmented options={SPLITS} value={settings.split} onChange={(k) => onSaveSettings({ split: k })} />
      <Text style={[s.caption, { paddingHorizontal: 0, marginTop: 8 }]}>
        {SPLITS[settings.split].hint} Necesidades {BUCKETS.needs.pct}% · Deseos {BUCKETS.wants.pct}% · Ahorro {BUCKETS.savings.pct}%.
      </Text>
    </Card>
    <Text style={s.hint}>Elige el reparto que mejor se adapte a tu vida. La dona, el ritmo y las metas de ahorro se ajustan solos.</Text>

    <Title>Recordatorios</Title>
    <Card>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <Text style={[s.body, { flex: 1, marginRight: 12 }]}>Avisarme de mis pagos recurrentes</Text>
        <Switch trackColor={{ false: "#3B475C", true: "#2D8A4E" }} value={rem.on} onValueChange={(v) => setReminders({ ...rem, on: v })} />
      </View>
      {rem.on && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <Segmented options={{ 0: { label: 'Mismo día' }, 1: { label: '1 día antes' }, 3: { label: '3 días antes' } }} value={String(rem.before)} onChange={(k) => setReminders({ ...rem, before: Number(k) })} />
          <Segmented options={{ 8: { label: '8:00' }, 9: { label: '9:00' }, 12: { label: '12:00' }, 18: { label: '18:00' } }} value={String(rem.hour)} onChange={(k) => setReminders({ ...rem, hour: Number(k) })} />
        </View>
      )}
      <View style={[s.row, s.sep, { justifyContent: 'space-between' }]}>
        <Text style={[s.body, { flex: 1, marginRight: 12 }]}>Recordarme registrar mis gastos (9 pm)</Text>
        <Switch trackColor={{ false: "#3B475C", true: "#2D8A4E" }} value={rem.daily} onValueChange={(v) => setReminders({ ...rem, daily: v })} />
      </View>
      {Platform.OS === 'web' && (
        <View style={[s.row, s.sep, { justifyContent: 'space-between' }]}>
          <Text style={[s.body, { flex: 1, marginRight: 12 }]}>Avisarme cuando cierre mi ciclo y cuánto ahorré</Text>
          <Switch trackColor={{ false: "#3B475C", true: "#2D8A4E" }} value={rem.close !== false} onValueChange={(v) => setReminders({ ...rem, close: v })} />
        </View>
      )}
    </Card>
    <Text style={s.hint}>
      {Platform.OS === 'web'
        ? 'Las notificaciones las envía el servidor a este dispositivo, a la hora de tu zona horaria. Necesitas activarlas arriba en "Notificaciones push".'
        : 'Las notificaciones se programan en este teléfono y se actualizan cada vez que abres la app.'}
    </Text>

  </>);
  const limB = (<>
    <Title>Límites mensuales por categoría</Title>
    <Card>
      {CATS.filter((c) => c.bucket !== 'savings').map((c, i) => (
        <LimitRow key={c.name} first={i === 0} icon={c.icon} cat={c.name} value={limits[c.name]} spent={monthByCat[c.name] || 0} onSave={onSaveLimit} />
      ))}
    </Card>
    <Text style={s.hint}>Déjalo vacío si no quieres límite. Te avisamos en el Resumen y al registrar un gasto cuando llegues al 80% y al 100%.</Text>
    <Pressable onPress={suggest}><Text style={[s.link, { textAlign: 'center', marginTop: 12 }]}>💡 Sugerir límites según mi historial</Text></Pressable>
    {!!limMsg && <Text style={s.hint}>{limMsg}</Text>}

  </>);
  const accB = (<>
    <Title>Seguridad</Title>
    <Card style={{ padding: 16 }}>
      <Text style={s.body}>Cerrar sesión por inactividad</Text>
      <Segmented options={IDLE_OPTIONS} value={String(idle.minutes)} onChange={(k) => idle.setMinutes(Number(k))} />
    </Card>
    <Text style={s.hint}>Si no usas la app durante este tiempo, cerramos tu sesión en este dispositivo para proteger tu cuenta. Te avisamos 60 segundos antes.</Text>

    <Title>Cuenta</Title>
    <Card style={{ padding: 16 }}>
      <Text style={s.body}>{session.user.email}</Text>
      <Pressable onPress={exportCsv}><Text style={[s.link, { marginTop: 12 }]}>Exportar mis movimientos (CSV)</Text></Pressable>
      {!!exportMsg && <Text style={[s.hint, { color: '#F87171' }]}>{exportMsg}</Text>}
      <Pressable onPress={() => signOutLocal()}><Text style={[s.link, { color: '#F87171', marginTop: 12 }]}>Cerrar sesión</Text></Pressable>
    </Card>
    <Text style={s.hint}>Cerrar sesión solo afecta a este dispositivo y borra la copia local de tus datos.</Text>
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
