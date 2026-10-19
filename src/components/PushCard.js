import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card, Title } from './ui';
import { s } from '../theme/styles';

const INSTALL_STEPS = [
  'Abre esta página en Safari.',
  'Toca el botón Compartir (el cuadro con una flecha hacia arriba) en la barra de abajo.',
  'Desliza y toca "Añadir a pantalla de inicio", y confirma con "Añadir".',
  'Cierra Safari y abre la app desde el nuevo ícono "Finanzas".',
  'Entra a Ajustes y toca "Activar notificaciones".',
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

// Tarjeta de Ajustes para activar las notificaciones push de este dispositivo (solo web)
export function PushCard({ push }) {
  const { status, busy, error, enable, disable, test } = push;
  if (status === 'loading') return null;
  return (
    <>
      <Title>Notificaciones push</Title>
      {status === 'needs-install' ? <InstallGuide /> : (
        <Card style={{ padding: 16 }}>
          {MESSAGES[status] && <Text style={s.body}>{MESSAGES[status]}</Text>}
          {status === 'ready' && (
            <>
              <Text style={s.body}>Recibe avisos de tus pagos y de tu caja de ahorro en este dispositivo.</Text>
              <Pressable style={[s.button, busy && { opacity: 0.6 }]} onPress={enable} disabled={busy}><Text style={s.buttonText}>{busy ? 'Un momento…' : 'Activar notificaciones'}</Text></Pressable>
            </>
          )}
          {status === 'enabled' && (
            <>
              <Text style={[s.body, { color: '#34C759' }]}>✓ Notificaciones activas en este dispositivo</Text>
              <Text style={[s.caption, { paddingHorizontal: 0, marginTop: 4 }]}>Elige qué avisos quieres en la tarjeta Recordatorios.</Text>
              <Pressable onPress={test} disabled={busy}><Text style={[s.link, { marginTop: 12 }]}>Enviar notificación de prueba</Text></Pressable>
              <Pressable onPress={disable} disabled={busy}><Text style={[s.link, { color: '#FF3B30', marginTop: 12 }]}>Desactivar en este dispositivo</Text></Pressable>
            </>
          )}
          {!!error && <Text style={[s.hint, { color: '#FF3B30' }]}>{error}</Text>}
        </Card>
      )}
    </>
  );
}
