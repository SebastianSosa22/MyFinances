import React, { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { C } from '../theme/colors';

const NATIVE = Platform.OS !== 'web';
const LOGO = Platform.OS === 'web' ? { uri: '/icon-192.png' } : require('../../assets/icon.png');
const SIZE = 96;
const MIN_MS = 1400; // tiempo mínimo en pantalla para que la animación se alcance a ver
const BEAT = 800;

// Pantalla de carga al abrir la app: el logo entra, "respira" con un aro que se expande
// y, cuando la app está lista (ready) y pasó el tiempo mínimo, todo se desvanece.
// Repite la animación de la pantalla de carga de public/index.html para que el cambio no se note.
export function SplashScreen({ ready, onDone }) {
  const [enter] = useState(() => new Animated.Value(0));
  const [beat] = useState(() => new Animated.Value(0));
  const [ring] = useState(() => new Animated.Value(0));
  const [out] = useState(() => new Animated.Value(1));
  const [minDone, setMinDone] = useState(false);

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 600, easing: Easing.out(Easing.back(1.6)), useNativeDriver: NATIVE }).start();
    const loop = Animated.loop(Animated.parallel([
      Animated.sequence([
        Animated.timing(beat, { toValue: 1, duration: BEAT, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
        Animated.timing(beat, { toValue: 0, duration: BEAT, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
      ]),
      Animated.sequence([
        Animated.timing(ring, { toValue: 1, duration: BEAT * 2, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
        Animated.timing(ring, { toValue: 0, duration: 0, useNativeDriver: NATIVE }),
      ]),
    ]));
    const t = setTimeout(() => loop.start(), 600);
    const m = setTimeout(() => setMinDone(true), MIN_MS);
    return () => { clearTimeout(t); clearTimeout(m); loop.stop(); };
  }, [enter, beat, ring]);

  useEffect(() => {
    if (!ready || !minDone) return;
    Animated.timing(out, { toValue: 0, duration: 380, easing: Easing.in(Easing.cubic), useNativeDriver: NATIVE }).start(() => onDone && onDone());
  }, [ready, minDone, out, onDone]);

  const logoScale = Animated.multiply(
    enter.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
    Animated.add(beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }), out.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0] })),
  );

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, st.wrap, { opacity: out }]}>
      <View style={st.logo}>
        <Animated.View style={[st.ring, {
          opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
          transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
        }]} />
        <Animated.Image source={LOGO} style={[st.img, { opacity: enter, transform: [{ scale: logoScale }] }]} />
      </View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrap: { backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  logo: { width: SIZE, height: SIZE },
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 26, borderWidth: 2, borderColor: C.primary },
  img: { width: SIZE, height: SIZE, borderRadius: 22 },
});
