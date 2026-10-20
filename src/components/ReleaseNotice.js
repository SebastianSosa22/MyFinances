import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal } from 'react-native';
import { RELEASE } from '../constants/release';
import { s } from '../theme/styles';

// Ventana de novedades con los pasos para reinstalar la app y la dirección para hacerlo
export function ReleaseNotice({ visible, onClose }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? window.location.origin : '';

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch (e) { /* el usuario puede copiarlo a mano */ }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.noticeOverlay}>
        <View style={s.noticeCard}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={s.noticeTitle}>{RELEASE.title}</Text>
            {RELEASE.highlights.map((text) => <Text key={text} style={[s.body, { fontSize: 15, marginTop: 8 }]}>{text}</Text>)}

            <Text style={[s.body, { fontWeight: '600', marginTop: 18 }]}>{RELEASE.stepsTitle}</Text>
            {RELEASE.steps.map((text, i) => (
              <View key={i} style={s.stepRow}>
                <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
                <Text style={[s.body, { flex: 1, fontSize: 15 }]}>{text}</Text>
              </View>
            ))}

            <View style={s.urlBox}>
              <Text selectable style={[s.body, { flex: 1, fontSize: 15, color: '#007AFF' }]}>{url}</Text>
              <Pressable onPress={copy} hitSlop={8}><Text style={s.link}>{copied ? '¡Copiado!' : 'Copiar'}</Text></Pressable>
            </View>
            <Text style={[s.caption, { paddingHorizontal: 0, marginTop: 8 }]}>{RELEASE.androidNote}</Text>
            <Text style={[s.caption, { paddingHorizontal: 0, marginTop: 4 }]}>{RELEASE.note}</Text>
          </ScrollView>
          <Pressable style={s.button} onPress={onClose}><Text style={s.buttonText}>Entendido</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}
