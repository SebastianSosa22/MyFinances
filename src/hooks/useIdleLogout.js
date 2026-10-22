import { useState, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signOutLocal } from '../lib/session';
import { DEFAULT_IDLE_MINUTES, IDLE_OPTIONS, WARNING_SECONDS } from '../constants/security';

// Cierra la sesión de ESTE dispositivo (las demás sesiones del usuario no se tocan), borra la copia local de datos y deja una marca para avisar en el login
export async function idleSignOut() {
  await AsyncStorage.setItem('idle_logout', '1');
  await AsyncStorage.removeItem('last_activity');
  await signOutLocal();
}

// Cierra la sesión tras un rato sin actividad. Avisa 60 s antes y también cuenta el tiempo con la app cerrada o en segundo plano.
export function useIdleLogout() {
  const [minutes, setMinutesState] = useState(DEFAULT_IDLE_MINUTES);
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WARNING_SECONDS);
  const last = useRef(Date.now());       // última actividad
  const saved = useRef(0);               // última vez que se guardó en disco
  const warned = useRef(false);
  const minutesRef = useRef(DEFAULT_IDLE_MINUTES);

  const persist = (force) => {
    const now = Date.now();
    if (force || now - saved.current > 10000) { saved.current = now; AsyncStorage.setItem('last_activity', String(now)); }
  };

  // Cualquier toque, tecla o scroll cuenta como actividad (con el aviso abierto solo "Seguir conectado" renueva)
  const touch = () => {
    if (warned.current) return;
    last.current = Date.now();
    persist(false);
  };

  const check = () => {
    const limit = minutesRef.current * 60000;
    const idle = Date.now() - last.current;
    if (idle >= limit) { idleSignOut(); return; }
    const warnMs = Math.min(WARNING_SECONDS * 1000, limit / 2);
    if (idle >= limit - warnMs) {
      warned.current = true;
      setWarning(true);
      setSecondsLeft(Math.ceil((limit - idle) / 1000));
    }
  };

  const stay = () => {
    warned.current = false;
    setWarning(false);
    last.current = Date.now();
    persist(true);
  };

  const setMinutes = (m) => {
    minutesRef.current = m;
    setMinutesState(m);
    AsyncStorage.setItem('idle_minutes', String(m));
    touch();
  };

  // Al abrir la app: si pasó más del tiempo permitido desde la última actividad, se cierra la sesión
  useEffect(() => {
    let alive = true;
    (async () => {
      const [m, l] = await Promise.all([AsyncStorage.getItem('idle_minutes'), AsyncStorage.getItem('last_activity')]);
      if (!alive) return;
      const mins = m && String(Number(m)) in IDLE_OPTIONS ? Number(m) : DEFAULT_IDLE_MINUTES;
      minutesRef.current = mins;
      setMinutesState(mins);
      if (l && Date.now() - Number(l) >= mins * 60000) { idleSignOut(); return; }
      last.current = Date.now();
      persist(true);
    })();
    return () => { alive = false; };
  }, []);

  // Revisión cada segundo y al volver a la app
  useEffect(() => {
    const timer = setInterval(check, 1000);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && check());
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'wheel'];
    if (Platform.OS === 'web') {
      events.forEach((e) => window.addEventListener(e, touch, { passive: true, capture: true }));
      document.addEventListener('visibilitychange', onVisible);
    }
    return () => {
      clearInterval(timer);
      sub.remove();
      if (Platform.OS === 'web') {
        events.forEach((e) => window.removeEventListener(e, touch, { capture: true }));
        document.removeEventListener('visibilitychange', onVisible);
      }
    };
  }, []);

  return {
    minutes, setMinutes, warning, secondsLeft, stay, logoutNow: idleSignOut,
    // En iOS/Android la actividad se detecta con los toques de la vista raíz
    activityProps: Platform.OS === 'web' ? {} : { onTouchStartCapture: touch },
  };
}
