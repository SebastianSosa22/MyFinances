import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { s } from '../theme/styles';

export const ITEM_H = 44;
const VISIBLE = 5;

// Columna tipo "rueda" de iOS: se desliza y se queda en la opción del centro.
// items: textos · index: posición elegida · onChange(i) al detenerse
export function WheelColumn({ items, index, onChange, flex = 1, align = 'center' }) {
  const ref = useRef(null);
  const timer = useRef(null);
  const [live, setLive] = useState(index); // opción al centro mientras se desliza (para resaltarla)

  // Lleva la rueda a la opción elegida (al abrir o si cambia desde fuera, p. ej. "Hoy" / "Ayer")
  useEffect(() => {
    if (ref.current) ref.current.scrollTo({ y: index * ITEM_H, animated: false });
  }, [index, items.length]);

  const settle = (y) => {
    const i = Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM_H)));
    if (ref.current) ref.current.scrollTo({ y: i * ITEM_H, animated: true });
    if (i !== index) onChange(i);
  };
  const onScroll = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    setLive(Math.round(y / ITEM_H));
    // En la web no hay evento de "terminó el deslizamiento": se espera a que deje de moverse
    clearTimeout(timer.current);
    timer.current = setTimeout(() => settle(y), 120);
  };

  return (
    <View style={{ flex, height: ITEM_H * VISIBLE }}>
      <ScrollView
        ref={ref} showsVerticalScrollIndicator={false} snapToInterval={ITEM_H} decelerationRate="fast"
        onScroll={onScroll} scrollEventThrottle={16} nestedScrollEnabled
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
      >
        {items.map((label, i) => {
          const d = Math.abs(i - live);
          return (
            <View key={label + '-' + i} style={{ height: ITEM_H, justifyContent: 'center', alignItems: align }}>
              <Text style={[s.wheelText, { opacity: d === 0 ? 1 : d === 1 ? 0.6 : 0.3, fontSize: d === 0 ? 26 : 22 }]}>{label}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Banda que marca la opción del centro (va detrás de las columnas)
export const WheelBand = () => <View pointerEvents="none" style={[s.wheelBand, { top: ITEM_H * 2, height: ITEM_H }]} />;
