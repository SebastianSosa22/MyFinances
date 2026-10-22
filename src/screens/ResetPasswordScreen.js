import React, { useState } from 'react';
import { Text, Pressable } from 'react-native';
import { Card } from '../components/ui';
import { DismissKeyboard } from '../components/DismissKeyboard';
import { MIN_PASSWORD, authErrorMessage } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { s } from '../theme/styles';
import { PasswordField } from './LoginScreen';

// Pantalla que se muestra al entrar desde el enlace del correo para crear una contraseña nueva
export function ResetPasswordScreen({ onDone }) {
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (pass.length < MIN_PASSWORD) { setMsg({ type: 'error', text: 'La contraseña debe tener al menos ' + MIN_PASSWORD + ' caracteres.' }); return; }
    if (pass !== confirm) { setMsg({ type: 'error', text: 'Las contraseñas no coinciden.' }); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pass });
    setBusy(false);
    if (error) { setMsg({ type: 'error', text: authErrorMessage(error) }); return; }
    setMsg({ type: 'ok', text: 'Listo, tu contraseña cambió.' });
    setTimeout(onDone, 900);
  };

  return (
    <DismissKeyboard style={[s.container, { padding: 16, justifyContent: 'center' }]}>
      <Text style={s.largeTitle}>Nueva contraseña</Text>
      <Card style={{ padding: 16 }}>
        <PasswordField placeholder="Contraseña nueva" value={pass} onChangeText={setPass} isNew />
        <PasswordField placeholder="Confirmar contraseña" value={confirm} onChangeText={setConfirm} isNew onSubmitEditing={submit} />
        <Text style={[s.caption, { paddingHorizontal: 4 }]}>Mínimo {MIN_PASSWORD} caracteres.</Text>
        <Pressable style={[s.button, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          <Text style={s.buttonText}>{busy ? 'Un momento…' : 'Guardar contraseña'}</Text>
        </Pressable>
      </Card>
      {!!msg.text && <Text style={[s.hint, { color: msg.type === 'error' ? '#FF3B30' : '#34C759' }]}>{msg.text}</Text>}
    </DismissKeyboard>
  );
}
