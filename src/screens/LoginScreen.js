import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Card } from '../components/ui';
import { authErrorMessage, MIN_PASSWORD, validateCredentials } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { s } from '../theme/styles';
import { DismissKeyboard } from '../components/DismissKeyboard';

// Campo de contraseña con su propio botón Mostrar/Ocultar
function PasswordField({ value, onChangeText, placeholder, isNew, onSubmitEditing }) {
  const [show, setShow] = useState(false);
  return (
    <View style={[s.input, s.passRow]}>
      <TextInput
        style={s.passInput} placeholder={placeholder} secureTextEntry={!show} autoCapitalize="none"
        autoComplete={isNew ? 'new-password' : 'current-password'} textContentType={isNew ? 'newPassword' : 'password'}
        value={value} onChangeText={onChangeText} onSubmitEditing={onSubmitEditing}
      />
      <Pressable onPress={() => setShow(!show)} hitSlop={8}><Text style={s.link}>{show ? 'Ocultar' : 'Mostrar'}</Text></Pressable>
    </View>
  );
}

export function LoginScreen() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);
  const isSignUp = mode === 'signup';

  const changeMode = (m) => { setMode(m); setConfirm(''); setMsg({ type: '', text: '' }); };

  const submit = async () => {
    const problem = validateCredentials({ email, password: pass, confirm, isSignUp });
    if (problem) { setMsg({ type: 'error', text: problem }); return; }
    setBusy(true);
    setMsg({ type: '', text: '' });
    const creds = { email: email.trim().toLowerCase(), password: pass };
    const { data, error } = isSignUp ? await supabase.auth.signUp(creds) : await supabase.auth.signInWithPassword(creds);
    setBusy(false);
    if (error) { setMsg({ type: 'error', text: authErrorMessage(error) }); return; }
    if (isSignUp) {
      // Con confirmación de correo activa, Supabase no marca error si el correo ya existía: lo detectamos aquí
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setMsg({ type: 'error', text: 'Ese correo ya tiene una cuenta. Inicia sesión.' });
      } else if (!data.session) {
        setMsg({ type: 'info', text: 'Cuenta creada. Te enviamos un correo para confirmarla; después inicia sesión.' });
      }
    }
    // Si hay sesión, la app cambia sola a la pantalla principal
  };

  return (
    <DismissKeyboard style={[s.container, { padding: 16, justifyContent: 'center' }]}>
      <Text style={s.largeTitle}>Finanzas</Text>
      <Card style={{ padding: 16 }}>
        <TextInput
          style={s.input} placeholder="Correo" autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
          autoComplete="email" textContentType="emailAddress" value={email} onChangeText={setEmail}
        />
        <PasswordField placeholder="Contraseña" value={pass} onChangeText={setPass} isNew={isSignUp} onSubmitEditing={isSignUp ? undefined : submit} />
        {isSignUp && (
          <>
            <PasswordField placeholder="Confirmar contraseña" value={confirm} onChangeText={setConfirm} isNew onSubmitEditing={submit} />
            <Text style={[s.caption, { paddingHorizontal: 4 }]}>Mínimo {MIN_PASSWORD} caracteres.</Text>
          </>
        )}
        <Pressable style={[s.button, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          <Text style={s.buttonText}>{busy ? 'Un momento…' : isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}</Text>
        </Pressable>
      </Card>
      {!!msg.text && <Text style={[s.hint, { color: msg.type === 'error' ? '#FF3B30' : '#34C759' }]}>{msg.text}</Text>}
      <Pressable onPress={() => changeMode(isSignUp ? 'signin' : 'signup')}>
        <Text style={[s.link, { textAlign: 'center', marginTop: 16 }]}>{isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Crea una'}</Text>
      </Pressable>
    </DismissKeyboard>
  );
}
