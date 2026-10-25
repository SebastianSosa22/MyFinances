import React from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

// Ventana que sube desde abajo con su título; se cierra tocando la parte oscura de arriba
export function BottomSheet({ visible, title, subtitle, onClose, children }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={onClose} accessibilityLabel="Cerrar" />
      <View style={[s.bottomSheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={s.grabber} />
        {!!title && <Text style={[s.sectionBig, { marginTop: 10, marginBottom: subtitle ? 4 : 12 }]}>{title}</Text>}
        {!!subtitle && <Text style={[s.balanceSub, { fontSize: 15, marginTop: 0, marginBottom: 12 }]}>{subtitle}</Text>}
        {children}
      </View>
    </Modal>
  );
}

// Fila de opción con ✓ cuando está elegida
export const OptionRow = ({ label, on, onPress, first }) => (
  <Pressable accessibilityRole="button" style={[s.row, { paddingHorizontal: 0, paddingVertical: 16 }, !first && s.sep]} onPress={onPress}>
    <Text style={[s.body, { flex: 1, fontSize: 18 }]}>{label}</Text>
    {on && <Text style={{ color: C.link, fontSize: 20 }}>✓</Text>}
  </Pressable>
);
