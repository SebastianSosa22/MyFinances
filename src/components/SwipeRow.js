import React, { useRef } from 'react';
import { View, Text, Pressable, Animated, PanResponder } from 'react-native';
import { DEL_W, s } from '../theme/styles';

export function SwipeRow({ children, onDelete, first }) {
  const x = useRef(new Animated.Value(0)).current;
  const open = useRef(false);
  const snap = (end) => {
    open.current = end < -DEL_W / 2;
    Animated.spring(x, { toValue: open.current ? -DEL_W : 0, useNativeDriver: true, bounciness: 0 }).start();
  };
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => x.setValue(Math.max(-DEL_W, Math.min(0, (open.current ? -DEL_W : 0) + g.dx))),
    onPanResponderRelease: (_, g) => snap((open.current ? -DEL_W : 0) + g.dx),
    onPanResponderTerminate: (_, g) => snap((open.current ? -DEL_W : 0) + g.dx),
  })).current;
  return (
    <View style={!first && s.sep}>
      <View style={s.delBg}><Pressable style={s.delBtn} onPress={onDelete}><Text style={s.delText}>Borrar</Text></Pressable></View>
      <Animated.View style={{ transform: [{ translateX: x }], backgroundColor: '#fff' }} {...pan.panHandlers}>{children}</Animated.View>
    </View>
  );
}
