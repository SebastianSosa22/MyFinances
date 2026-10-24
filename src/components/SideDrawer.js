import React, { useEffect, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

// Panel que entra desde la izquierda y tapa la pantalla (también la barra de abajo).
// Se cierra con la ✕, tocando fuera del panel (la franja de la derecha donde se ve la pantalla de atrás)
// o con el botón "atrás" de Android: sale animado y luego avisa con onClose.
export function SideDrawer({ open, onClose, children, activityProps }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const panelW = Math.min(width * 0.8, 400);
  const [x] = useState(() => new Animated.Value(-panelW));

  useEffect(() => {
    if (!open) return;
    x.setValue(-panelW);
    Animated.timing(x, { toValue: 0, duration: 260, useNativeDriver: true }).start();
  }, [open, panelW, x]);

  const close = () => Animated.timing(x, { toValue: -panelW, duration: 200, useNativeDriver: true }).start(() => onClose());
  const fade = x.interpolate({ inputRange: [-panelW, 0], outputRange: [0, 1], extrapolate: 'clamp' });
  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={close}>
      <View style={{ flex: 1 }} {...activityProps}>
        {/* La zona que recibe el toque es un Pressable fijo; la sombra animada va dentro y no recibe toques */}
        <Pressable style={s.drawerTouch} onPress={close} accessibilityLabel="Cerrar ajustes">
          <Animated.View pointerEvents="none" style={[s.drawerShade, { opacity: fade }]} />
        </Pressable>
        <Animated.View style={[s.drawer, { width: panelW, paddingTop: insets.top, transform: [{ translateX: x }] }]}>
          <Pressable style={[s.drawerClose, { top: insets.top + 12 }]} onPress={close} hitSlop={12} accessibilityLabel="Cerrar">
            <Icon name="x" size={20} color={C.text} />
          </Pressable>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
