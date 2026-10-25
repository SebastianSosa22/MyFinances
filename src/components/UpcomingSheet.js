import React from 'react';
import { View, Text, Pressable, ScrollView, Modal } from 'react-native';
import { CATS } from '../constants/budget';
import { money } from '../lib/format';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

// Ventana de la campana: pagos fijos y pagos de tarjeta que vencen en los próximos 7 días
export function UpcomingSheet({ visible, items, hide, onClose }) {
  const total = items.reduce((a, u) => a + u.m.amount, 0);
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable accessibilityRole="button" style={s.noticeOverlay} onPress={onClose}>
        <Pressable accessibilityRole="button" style={s.noticeCard} onPress={() => {}}>
          <Text style={s.noticeTitle}>Próximos 7 días</Text>
          {items.length === 0 && <Text style={[s.body, { fontSize: 15, marginTop: 10, color: C.muted }]}>No tienes pagos fijos ni de tarjeta en los próximos 7 días.</Text>}
          <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
            {items.map((u, i) => {
              const c = CATS.find((z) => z.name === u.m.cat);
              return (
                <View key={u.m.id + '-' + i} style={[s.row, { paddingHorizontal: 0 }, i > 0 && s.sep]}>
                  <Text style={{ fontSize: 22, marginRight: 12 }}>{u.icon || (c ? c.icon : '🧾')}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.body} numberOfLines={1}>{u.m.note || u.m.cat}</Text>
                    <Text style={[s.caption, { paddingHorizontal: 0 }]}>{u.d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' })}</Text>
                  </View>
                  <Text style={[s.body, { color: C.red }]}>{hide ? '$•••' : '-' + money(u.m.amount, true)}</Text>
                </View>
              );
            })}
          </ScrollView>
          {items.length > 0 && (
            <View style={[s.row, s.sep, { paddingHorizontal: 0, justifyContent: 'space-between' }]}>
              <Text style={s.body}>Total por pagar</Text>
              <Text style={[s.body, { fontWeight: '600' }]}>{hide ? '$•••' : money(total, true)}</Text>
            </View>
          )}
          <Pressable accessibilityRole="button" style={s.button} onPress={onClose}><Text style={s.buttonText}>Listo</Text></Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
