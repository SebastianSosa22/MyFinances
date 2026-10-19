import React from 'react';
import { View, Keyboard, Platform, TouchableWithoutFeedback } from 'react-native';

// Al tocar fuera de un campo de texto se cierra el teclado (en iOS/Android).
// En web no hace falta: el navegador ya quita el foco al hacer clic fuera.
export function DismissKeyboard({ children, style }) {
  if (Platform.OS === 'web') return <View style={style}>{children}</View>;
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={style}>{children}</View>
    </TouchableWithoutFeedback>
  );
}
