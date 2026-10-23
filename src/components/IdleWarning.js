import React from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { s } from '../theme/styles';

// Aviso antes de cerrar la sesión por inactividad
export function IdleWarning({ visible, seconds, onStay, onLogout }) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onStay}>
      <View style={s.noticeOverlay}>
        <View style={s.noticeCard}>
          <Text style={s.noticeTitle}>¿Sigues ahí?</Text>
          <Text style={[s.body, { marginTop: 8 }]}>Por seguridad, cerraremos tu sesión en {seconds} s por inactividad.</Text>
          <Pressable style={s.button} onPress={onStay}><Text style={s.buttonText}>Seguir conectado</Text></Pressable>
          <Pressable onPress={onLogout}><Text style={[s.link, { color: '#F87171', textAlign: 'center', marginTop: 14 }]}>Cerrar sesión ahora</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}
