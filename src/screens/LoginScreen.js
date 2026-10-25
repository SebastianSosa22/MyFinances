import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Animated, Easing, Platform } from 'react-native';
import { authErrorMessage, MIN_PASSWORD, validateCredentials, validateSignUpStep } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { C } from '../theme/colors';
import { s } from '../theme/styles';
import { DismissKeyboard } from '../components/DismissKeyboard';
import { Icon } from '../components/Icon';

const PLACEHOLDER = '#5D6A80';
const NATIVE = Platform.OS !== 'web';
const SIGNUP_PROMPTS = ['¿Cómo te llamas?', '¿Cuál es tu correo?', 'Crea tu contraseña'];
const LAST_STEP = SIGNUP_PROMPTS.length - 1;

// Barritas de progreso del registro
function StepDots({ step }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 4 }}>
      {SIGNUP_PROMPTS.map((_, i) => (
        <View key={i} style={{ width: i === step ? 28 : 10, height: 6, borderRadius: 3, marginHorizontal: 4, backgroundColor: i <= step ? C.primary : C.border }} />
      ))}
    </View>
  );
}

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
      {secure && <Pressable accessibilityRole="button" onPress={() => setShow(!show)} hitSlop={8}><Text style={{ color: C.muted, fontSize: 15 }}>{show ? 'Ocultar' : 'Mostrar'}</Text></Pressable>}
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
      <Pressable accessibilityRole="button" onPress={() => setShow(!show)} hitSlop={8}><Text style={s.link}>{show ? 'Ocultar' : 'Mostrar'}</Text></Pressable>
    </View>
  );
}

export function LoginScreen() {
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0); // paso del registro
  const [fade] = useState(() => new Animated.Value(1));
  const [slide] = useState(() => new Animated.Value(0));
  const isSignUp = mode === 'signup';

  const changeMode = (m) => {
    setMode(m); setConfirm(''); setMsg({ type: '', text: '' });
    setStep(0); fade.setValue(1); slide.setValue(0);
  };

  // Cambia de paso: el actual sale deslizándose y el nuevo entra desde el otro lado
  const goTo = (n) => {
    const dir = n > step ? 1 : -1;
    setMsg({ type: '', text: '' });
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 140, useNativeDriver: NATIVE }),
      Animated.timing(slide, { toValue: -40 * dir, duration: 140, useNativeDriver: NATIVE }),
    ]).start(() => {
      setStep(n);
      slide.setValue(40 * dir);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }),
        Animated.timing(slide, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }),
      ]).start();
    });
  };

  const next = () => {
    const problem = validateSignUpStep(step, { name, email, password: pass, confirm });
    if (problem) { setMsg({ type: 'error', text: problem }); return; }
    if (step < LAST_STEP) goTo(step + 1); else submit();
  };

  const submit = async () => {
    const problem = validateCredentials({ name, email, password: pass, confirm, isSignUp });
    if (problem) { setMsg({ type: 'error', text: problem }); return; }
    setBusy(true);
    setMsg({ type: '', text: '' });
    const creds = { email: email.trim().toLowerCase(), password: pass };
    // El nombre se guarda en los datos del usuario de Supabase Auth (user_metadata.full_name)
    const { data, error } = isSignUp
      ? await supabase.auth.signUp({ ...creds, options: { data: { full_name: name.trim() } } })
      : await supabase.auth.signInWithPassword(creds);
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
      <View style={s.loginLogo}><Icon name="vault" size={32} color={C.primary} width={1.7} /></View>
      <Text style={s.loginTitle}>¡Hola!</Text>
      <Text style={s.loginSub}>{isSignUp ? SIGNUP_PROMPTS[step] : 'Inicia sesión para tomar control de tus finanzas'}</Text>
      {isSignUp ? (
        <>
          <StepDots step={step} />
          <Animated.View style={{ opacity: fade, transform: [{ translateX: slide }] }}>
            {step === 0 && (
              <Field key="name" icon="👤" placeholder="Tu nombre" autoFocus autoCapitalize="words" autoComplete="name" textContentType="name"
                returnKeyType="next" value={name} onChangeText={setName} onSubmitEditing={next} />
            )}
            {step === 1 && (
              <Field key="email" icon="✉️" placeholder="Correo electrónico" autoFocus keyboardType="email-address" returnKeyType="next"
                value={email} onChangeText={setEmail} onSubmitEditing={next} />
            )}
            {step === 2 && (
              <>
                <Field key="pass" icon="🔒" secure isNew placeholder="Contraseña" autoFocus value={pass} onChangeText={setPass} />
                <Field key="confirm" icon="🔒" secure isNew placeholder="Confirmar contraseña" value={confirm} onChangeText={setConfirm} onSubmitEditing={next} />
                <Text style={[s.caption, { color: C.muted, paddingHorizontal: 6, marginTop: 8 }]}>Mínimo {MIN_PASSWORD} caracteres.</Text>
              </>
            )}
          </Animated.View>
        </>
      ) : (
        <>
          <Field icon="✉️" placeholder="Correo electrónico" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <Field icon="🔒" secure placeholder="Contraseña" value={pass} onChangeText={setPass} onSubmitEditing={submit} />
        </>
      )}
      <Pressable accessibilityRole="button" style={[s.loginButton, busy && { opacity: 0.6 }]} onPress={isSignUp ? next : submit} disabled={busy}>
        <Text style={s.loginButtonText}>{busy ? 'Un momento…' : !isSignUp ? 'Iniciar sesión  →' : step < LAST_STEP ? 'Siguiente  →' : 'Crear cuenta  →'}</Text>
      </Pressable>
      {isSignUp && step > 0 && (
        <Pressable accessibilityRole="button" onPress={() => goTo(step - 1)} disabled={busy}>
          <Text style={{ color: C.muted, textAlign: 'center', marginTop: 16, fontSize: 15 }}>‹ Atrás</Text>
        </Pressable>
      )}
      {!isSignUp && (
        <Pressable accessibilityRole="button" onPress={forgot} disabled={busy}>
          <Text style={{ color: C.muted, textAlign: 'center', marginTop: 16, fontSize: 15 }}>¿Olvidaste tu contraseña?</Text>
        </Pressable>
      )}
      {!!msg.text && <Text style={[s.hint, { color: msg.type === 'error' ? C.red : C.green }]}>{msg.text}</Text>}
      <Pressable accessibilityRole="button" onPress={() => changeMode(isSignUp ? 'signin' : 'signup')}>
        <Text style={s.loginLink}>{isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate aquí'}</Text>
      </Pressable>
    </DismissKeyboard>
  );
}