import React from 'react';
import { View, Text, Switch } from 'react-native';
import { Card, Title } from './ui';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

const INSTALL_STEPS = [
  'Abre esta página en Safari.',
  'Toca el botón Compartir (el cuadro con una flecha hacia arriba) en la barra de abajo.',
  'Desliza y toca "Añadir a pantalla de inicio", y confirma con "Añadir".',
  'Cierra Safari y abre la app desde el nuevo ícono "Finanzas".',
  'Entra a Ajustes y enciende "Notificaciones en este dispositivo".',
];

function InstallGuide() {
  return (
    <Card style={{ padding: 16 }}>
      <Text style={s.body}>📲 Instala la app para recibir avisos</Text>
      <Text style={[s.caption, { paddingHorizontal: 0, marginTop: 4 }]}>En iPhone, las notificaciones solo funcionan cuando la app está añadida a la pantalla de inicio y la abres desde su ícono.</Text>
      {INSTALL_STEPS.map((text, i) => (
        <View key={i} style={s.stepRow}>
          <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
          <Text style={[s.body, { flex: 1, fontSize: 15 }]}>{text}</Text>
        </View>
      ))}
    </Card>
  );
}

const MESSAGES = {
  unsupported: 'Este navegador no admite notificaciones push. Prueba con Safari en iPhone o con Chrome o Edge en computadora.',
  'not-configured': 'Faltan configurar las notificaciones: pega tu clave VAPID pública en src/lib/pushConfig.js.',
  denied: 'Bloqueaste las notificaciones. Actívalas en Ajustes del iPhone > Notificaciones > Finanzas (en computadora, desde el candado del navegador).',
};

// Tarjeta de Ajustes para activar o desactivar las notificaciones push de este dispositivo con un interruptor (solo web)
export function PushCard({ push }) {
  const { status, busy, error, enable, disable } = push;
  if (status === 'loading') return null;
  const canToggle = status === 'ready' || status === 'enabled';
  const on = status === 'enabled';
  return (
    <>
      <Title>Notificaciones push</Title>
      {status === 'needs-install' ? <InstallGuide /> : (
        <Card>
          {canToggle ? (
            <View style={[s.row, { paddingVertical: 14 }]}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={s.body}>Notificaciones en este dispositivo</Text>
                <Text style={[s.balanceSub, { marginTop: 3 }]}>{busy ? 'Un momento…' : on ? 'Elige qué avisos quieres en Recordatorios' : 'Avisos de tus pagos, tarjetas y ahorro'}</Text>
              </View>
              <Switch value={on} disabled={busy} onValueChange={(v) => (v ? enable() : disable())} trackColor={{ false: C.raisedHi, true: C.primary }} thumbColor="#fff" />
            </View>
          ) : (
            MESSAGES[status] && <Text style={[s.body, { padding: 16 }]}>{MESSAGES[status]}</Text>
          )}
          {!!error && <Text style={[s.hint, { color: C.red, marginTop: 0, marginBottom: 14, paddingHorizontal: 16 }]}>{error}</Text>}
        </Card>
      )}
    </>
  );
}
