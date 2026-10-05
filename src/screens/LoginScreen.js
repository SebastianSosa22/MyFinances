import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Card } from '../components/ui';
import { supabase } from '../lib/supabase';
import { s } from '../theme/styles';

export function LoginScreen() {
  const [email, setEmail] = useState(''), [pass, setPass] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const go = async (signUp) => {
    setBusy(true); setMsg('');
    const { data, error } = signUp ? await supabase.auth.signUp({ email, password: pass }) : await supabase.auth.signInWithPassword({ email, password: pass });
    setBusy(false);
    if (error) setMsg(error.message);
    else if (signUp && !data.session) setMsg('Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.');
  };
  return (
    <View style={[s.container, { padding: 16, justifyContent: 'center' }]}>
      <Text style={s.largeTitle}>Finanzas</Text>
      <Card style={{ padding: 16 }}>
        <TextInput style={s.input} placeholder="Correo" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={s.input} placeholder="Contraseña" secureTextEntry value={pass} onChangeText={setPass} />
        <Pressable style={s.button} onPress={() => go(false)} disabled={busy}><Text style={s.buttonText}>{busy ? 'Un momento…' : 'Iniciar sesión'}</Text></Pressable>
      </Card>
      <Pressable onPress={() => go(true)} disabled={busy}><Text style={[s.link, { textAlign: 'center', marginTop: 16 }]}>Crear cuenta</Text></Pressable>
      {!!msg && <Text style={[s.hint, { color: '#FF3B30' }]}>{msg}</Text>}
    </View>
  );
}
