import React, { useState } from 'react';
import { View, Text, Pressable, Switch, Platform } from 'react-native';
import { Icon } from '../components/Icon';
import { PushCard } from '../components/PushCard';
import { Segmented, Title } from '../components/ui';
import { CYCLES, DAYS, DAY_ORDER, SPLITS } from '../constants/budget';
import { useWide } from '../hooks/useWide';
import { track } from '../lib/analytics';
import { initials } from '../lib/auth';
import { exportMovesCsv } from '../lib/exportCsv';
import { signOutLocal } from '../lib/session';
import { C } from '../theme/colors';
import { MONO, s } from '../theme/styles';

const SWITCH = { trackColor: { false: C.raisedHi, true: C.primary }, thumbColor: '#fff' };

const Section = ({ title, children }) => (
  <>
    <Title>{title}</Title>
    <View style={[s.formList, { paddingHorizontal: 0, borderRadius: 18, marginTop: 0 }]}>{children}</View>
  </>
);

// Fila de opción: texto (y nota) a la izquierda y un control o flecha a la derecha
const Row = ({ label, note, right, onPress, first, danger }) => {
  const body = (
    <View style={[s.row, { paddingVertical: 13, paddingHorizontal: 16 }, !first && s.formSep]}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={[s.rowTitle, danger && { color: C.red, fontWeight: '600' }]}>{label}</Text>
        {!!note && <Text style={[s.rowSub, { marginTop: 3 }]}>{note}</Text>}
      </View>
      {right !== undefined ? right : onPress && <Icon name="chevron" size={18} color={C.muted} />}
    </View>
  );
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress}>{body}</Pressable> : body;
};

// Ajustes: perfil, tu dinero (cada cuánto cobras), notificaciones y cuenta.
// En el móvil se muestra dentro del panel lateral que abre el círculo de perfil.
export function SettingsScreen({ session, settings, onSaveSettings, push, rem, setReminders, moves, onStartTour, isAdmin, onOpenAdmin }) {
  const wide = useWide();
  const name = ((session.user.user_metadata && session.user.user_metadata.full_name) || '').trim();
  const [exportMsg, setExportMsg] = useState('');

  const exportCsv = async () => {
    setExportMsg('');
    try { await exportMovesCsv(moves); track('export_csv', { rows: moves.length }); } catch (e) { setExportMsg('No se pudo exportar: ' + (e instanceof Error ? e.message : String(e))); }
  };

  const profile = (
    <View style={[s.panel, s.profileHead, { padding: 16, marginBottom: 0, paddingRight: 16 }]}>
      <View style={[s.profileAvatar, { width: 56, height: 56, borderRadius: 28 }]}><Text style={[s.avatarText, { fontSize: 22 }]}>{initials(session.user)}</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.profileName, { fontSize: 18 }]} numberOfLines={2}>{name || 'Tu cuenta'}</Text>
        <Text style={s.rowSub} numberOfLines={1}>{session.user.email}</Text>
      </View>
      {!!isAdmin && <View style={[s.deltaChip, { backgroundColor: C.greenSoft }]}><Text style={[s.deltaText, { color: C.green, letterSpacing: 1 }]}>ADMIN</Text></View>}
    </View>
  );

  const money = (
    <Section title="Tu dinero">
      <View style={{ padding: 16 }}>
        <Text style={s.rowTitle}>¿Cada cuánto cobras?</Text>
        <Segmented options={CYCLES} value={settings.cycle} onChange={(k) => onSaveSettings({ cycle: k })} />
        {settings.cycle === 'weekly' && (
          <>
            <Text style={[s.rowTitle, { marginTop: 16 }]}>Día en que cobras</Text>
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              {DAY_ORDER.map((d) => (
                <Pressable accessibilityRole="button" key={d} onPress={() => onSaveSettings({ payDay: d })} style={[s.dayChip, settings.payDay === d && { backgroundColor: C.primary }]}>
                  <Text style={[s.chipText, { fontSize: 13 }, settings.payDay === d && { color: C.onPrimary }]}>{DAYS[d]}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
        <Text style={[s.rowSub, { marginTop: 8 }]}>Tu semana, quincena o mes en el Inicio empieza según cuándo cobras.</Text>
      </View>
      <View style={[{ padding: 16 }, s.formSep]}>
        <Text style={s.rowTitle}>Tu reparto</Text>
        <View style={[s.wrapRow, { marginTop: 10 }]}>
          {Object.entries(SPLITS).map(([k, v]) => (
            <Pressable accessibilityRole="button" key={k} onPress={() => onSaveSettings({ split: k })} style={[s.catChip, (settings.split || '50-30-20') === k && s.catChipOn]}>
              <Text style={[s.catChipText, { fontFamily: MONO }, (settings.split || '50-30-20') === k && { fontWeight: '600' }]}>{v.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[s.rowSub, { marginTop: 8 }]}>{(SPLITS[settings.split] || SPLITS['50-30-20']).hint} Necesidades / Deseos / Ahorro.</Text>
      </View>
    </Section>
  );

  const alerts = (
    <>
      {Platform.OS === 'web' && <PushCard push={push} />}
      <Section title="Recordatorios">
        <Row first label="Avisarme de mis pagos recurrentes" right={<Switch {...SWITCH} value={rem.on} onValueChange={(v) => setReminders({ ...rem, on: v })} />} />
        {rem.on && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
            <Segmented options={{ 0: { label: 'Mismo día' }, 1: { label: '1 día antes' }, 3: { label: '3 días antes' } }} value={String(rem.before)} onChange={(k) => setReminders({ ...rem, before: Number(k) })} />
            <Segmented options={{ 8: { label: '8:00' }, 9: { label: '9:00' }, 12: { label: '12:00' }, 18: { label: '18:00' } }} value={String(rem.hour)} onChange={(k) => setReminders({ ...rem, hour: Number(k) })} />
          </View>
        )}
        <Row label="Avisarme del corte y pago de mis tarjetas" note="Si debes algo: el día del corte, 3 días antes del pago y el día del pago" right={<Switch {...SWITCH} value={rem.cards !== false} onValueChange={(v) => setReminders({ ...rem, cards: v })} />} />
        <Row label="Recordarme registrar mis gastos" note="Todos los días a las 9 pm" right={<Switch {...SWITCH} value={rem.daily} onValueChange={(v) => setReminders({ ...rem, daily: v })} />} />
        {Platform.OS === 'web' && <Row label="Avisarme al cerrar mi ciclo" note="Con cuánto ahorraste" right={<Switch {...SWITCH} value={rem.close !== false} onValueChange={(v) => setReminders({ ...rem, close: v })} />} />}
      </Section>
      <Text style={[s.balanceSub, { paddingHorizontal: 4 }]}>
        {Platform.OS === 'web' ? 'Las notificaciones llegan a este dispositivo a la hora de tu zona horaria. Primero actívalas en "Notificaciones push".' : 'Las notificaciones se programan en este teléfono y se actualizan cada vez que abres la app.'}
      </Text>
    </>
  );

  const account = (
    <>
      <Section title="Cuenta">
        {!!isAdmin && !!onOpenAdmin && <Row first label="Panel de administrador" onPress={onOpenAdmin} />}
        {!!onStartTour && <Row first={!(isAdmin && onOpenAdmin)} label="Ver la guía de la app" note="Un recorrido corto por cada sección" onPress={onStartTour} />}
        <Row first={!onStartTour && !(isAdmin && onOpenAdmin)} label="Exportar mis movimientos" note="Archivo CSV para Excel o Numbers" onPress={exportCsv} />
        <Row label="Cerrar sesión" note="Solo en este dispositivo; borra la copia local de tus datos" danger onPress={() => signOutLocal()} right={null} />
      </Section>
      {!!exportMsg && <Text style={[s.balanceSub, { color: C.red, paddingHorizontal: 4 }]}>{exportMsg}</Text>}
    </>
  );

  return (
    <>
      <View style={s.screenHead}><Text style={s.screenTitle}>Ajustes</Text></View>
      {profile}
      {wide ? (
        <View style={s.cols}><View style={s.col}>{money}{account}</View><View style={s.col}>{alerts}</View></View>
      ) : (<>{money}{alerts}{account}</>)}
    </>
  );
}
