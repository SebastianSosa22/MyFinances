import React, { useEffect, useState } from 'react';
import { Text, Pressable } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { clearInvite, pendingInvite } from '../lib/invite';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

const REASONS = {
  not_found: 'Esta invitación ya no existe. Pídele a quien te invitó que te mande un link nuevo.',
  used: 'Esta invitación ya se usó. Pídele a quien te invitó que te mande un link nuevo.',
  own: 'Es tu propio link de invitación: compártelo con la otra persona para que lo abra en su teléfono.',
  already: 'Ya estabas conectado con esta persona.',
};

// Invitación pendiente (?invitacion=...): "Ana te invitó a compartir gastos" con Aceptar / Ahora no
export function InviteSheet({ net, onAccepted }) {
  const [state, setState] = useState(null); // { code, info } | { done, text }
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    pendingInvite().then(async (code) => {
      if (!code || !alive) return;
      const info = await net.inviteInfo(code);
      if (!alive) return;
      if (info && info.ok) setState({ code, info });
      else { clearInvite(); if (info && REASONS[info.reason]) setState({ done: true, text: REASONS[info.reason] }); }
    });
    return () => { alive = false; };
  }, []);
  if (!state) return null;
  const close = () => { clearInvite(); setState(null); };
  if (state.done) {
    return (
      <BottomSheet visible title="Gastos compartidos" subtitle={state.text} onClose={close}>
        <Pressable accessibilityRole="button" style={[s.saveBtn, { backgroundColor: C.primary }]} onPress={close}><Text style={s.saveBtnText}>Entendido</Text></Pressable>
      </BottomSheet>
    );
  }
  const accept = async () => {
    setBusy(true);
    const res = await net.accept(state.code);
    setBusy(false);
    clearInvite();
    if (res && res.ok) { setState({ done: true, text: 'Listo, ya estás conectado con ' + res.from + '. Verás sus gastos compartidos contigo en "Cuentas compartidas" del Inicio.' }); onAccepted && onAccepted(); }
    else setState({ done: true, text: REASONS[res && res.reason] || 'No se pudo aceptar la invitación. Inténtalo de nuevo más tarde.' });
  };
  const { info } = state;
  return (
    <BottomSheet visible title={info.from + ' te invitó'} subtitle={info.from + ' te agregó como "' + info.as + '" en sus gastos compartidos. Si aceptas, verás lo que comparten (cuánto te toca y lo que ya se pagó) y te llegarán avisos. Tus demás finanzas siguen siendo privadas.'} onClose={close}>
      <Pressable accessibilityRole="button" disabled={busy} style={[s.saveBtn, { backgroundColor: C.primary }]} onPress={accept}><Text style={s.saveBtnText}>{busy ? 'Aceptando…' : 'Aceptar invitación'}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={close} style={{ marginTop: 14 }}><Text style={[s.link, { textAlign: 'center', color: C.muted }]}>Ahora no</Text></Pressable>
    </BottomSheet>
  );
}
