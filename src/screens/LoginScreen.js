import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authErrorMessage, MIN_PASSWORD, validateCredentials } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { s } from '../theme/styles';
import { DismissKeyboard } from '../components/DismissKeyboard';

const PLACEHOLDER = 'rgba(255,255,255,0.5)';

// Campo con ícono a la izquierda y, si es contraseña, botón Mostrar/Ocultar
function Field({ icon, secure, isNew, onSubmitEditing, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <View style={s.loginField}>
      <Text style={{ fontSize: 18, marginRight: 12, opacity: 0.8 }}>{icon}</Text>
      <TextInput
        style={s.loginInput} placeholderTextColor={PLACEHOLDER} autoCapitalize="none" autoCorrect={false}
        secureTextEntry={secure && !show} onSubmitEditing={onSubmitEditing}
        autoComplete={secure ? (isNew ? 'new-password' : 'current-password') : 'email'}
        textContentType={secure ? (isNew ? 'newPassword' : 'password') : 'emailAddress'}
        {...props}
      />
      {secure && <Pressable onPress={() => setShow(!show)} hitSlop={8}><Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15 }}>{show ? 'Ocultar' : 'Mostrar'}</Text></Pressable>}
    </View>
  );
}

// Campo de contraseña con su propio botón Mostrar/Ocultar (lo usa también la pantalla de contraseña nueva)
export function PasswordField({ value, onChangeText, placeholder, isNew, onSubmitEditing }) {
  const [show, setShow] = useState(false);
  return (
    <View style={[s.input, s.passRow]}>
      <TextInput
        style={s.passInput} placeholder={placeholder} placeholderTextColor={PLACEHOLDER} secureTextEntry={!show} autoCapitalize="none"
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

  // Si la sesión se cerró por inactividad, lo avisamos una vez
  useEffect(() => {
    AsyncStorage.getItem('idle_logout').then((flag) => {
      if (flag) {
        setMsg({ type: 'info', text: 'Cerramos tu sesión por inactividad para proteger tu cuenta. Inicia sesión de nuevo.' });
        AsyncStorage.removeItem('idle_logout');
      }
    });
  }, []);

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

  // Envía el enlace para crear una contraseña nueva (el mensaje es el mismo exista o no la cuenta)
  const forgot = async () => {
    const problem = validateCredentials({ email, password: 'x', confirm: '', isSignUp: false });
    if (problem) { setMsg({ type: 'error', text: 'Escribe tu correo arriba y vuelve a tocar "¿Olvidaste tu contraseña?".' }); return; }
    setBusy(true);
    const redirectTo = typeof window !== 'undefined' && window.location ? window.location.origin : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
    setBusy(false);
    if (error) { setMsg({ type: 'error', text: authErrorMessage(error) }); return; }
    setMsg({ type: 'info', text: 'Si ese correo tiene una cuenta, te enviamos un enlace para crear una contraseña nueva.' });
  };

  return (
    <DismissKeyboard style={[s.container, s.loginWrap]}>
      <Text style={s.loginTitle}>¡Hola!</Text>
      <Text style={s.loginSub}>{isSignUp ? 'Crea tu cuenta para tomar control de tus finanzas' : 'Inicia sesión para tomar control de tus finanzas'}</Text>
      <Field icon="✉️" placeholder="Correo electrónico" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Field icon="🔒" secure isNew={isSignUp} placeholder="Contraseña" value={pass} onChangeText={setPass} onSubmitEditing={isSignUp ? undefined : submit} />
      {isSignUp && (
        <>
          <Field icon="🔒" secure isNew placeholder="Confirmar contraseña" value={confirm} onChangeText={setConfirm} onSubmitEditing={submit} />
          <Text style={[s.caption, { color: 'rgba(255,255,255,0.6)', paddingHorizontal: 6, marginTop: 8 }]}>Mínimo {MIN_PASSWORD} caracteres.</Text>
        </>
      )}
      <Pressable style={[s.loginButton, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
        <Text style={s.loginButtonText}>{busy ? 'Un momento…' : isSignUp ? 'Crear cuenta  →' : 'Iniciar sesión  →'}</Text>
      </Pressable>
      {!isSignUp && (
        <Pressable onPress={forgot} disabled={busy}>
          <Text style={{ color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 16, fontSize: 15 }}>¿Olvidaste tu contraseña?</Text>
        </Pressable>
      )}
      {!!msg.text && <Text style={[s.hint, { color: msg.type === 'error' ? '#FFB4B4' : '#C6F6D5' }]}>{msg.text}</Text>}
      <Pressable onPress={() => changeMode(isSignUp ? 'signin' : 'signup')}>
        <Text style={s.loginLink}>{isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate aquí'}</Text>
      </Pressable>
    </DismissKeyboard>
  );
}