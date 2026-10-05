import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Platform, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { s } from '../theme/styles';

// Hoja que baja desde arriba (para que el teclado no tape el contenido)
export function TopSheet({ visible, onClose, title, onSave, saveLabel = 'Guardar', children }) {
  const insets = useSafeAreaInsets();
  const [kb, setKb] = useState(false);
  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(show, () => setKb(true));
    const b = Keyboard.addListener(hide, () => setKb(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.sheetWrap}>
        <View style={[s.sheet, { paddingTop: insets.top + 12 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Pressable onPress={onClose}><Text style={s.link}>Cancelar</Text></Pressable>
            <Text numberOfLines={1} style={[s.body, { fontWeight: '600', flexShrink: 1, marginHorizontal: 8 }]}>{title}</Text>
            <Pressable onPress={onSave}><Text style={[s.link, { fontWeight: '600' }]}>{saveLabel}</Text></Pressable>
          </View>
          <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
        </View>
        <Pressable style={{ flex: 1 }} onPress={() => (kb ? Keyboard.dismiss() : onClose())} />
      </View>
    </Modal>
  );
}
