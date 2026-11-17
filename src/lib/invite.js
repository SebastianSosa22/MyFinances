import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Links de la app: ?invitacion=<código> (te invitan a compartir gastos) y ?compartidos=1 (abre Cuentas compartidas, lo usan los avisos push).
// El código se guarda en el dispositivo para que siga ahí si la persona primero tiene que crear su cuenta o iniciar sesión.
const KEY = 'pending_invite';
const SITE = 'https://myfinances-xfmf.onrender.com';
let openShared = false;

export function captureLinks() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('invitacion');
    if (code && /^[A-Za-z0-9]{16,64}$/.test(code)) AsyncStorage.setItem(KEY, code).catch(() => {});
    if (url.searchParams.get('compartidos')) openShared = true;
    if (code || openShared) {
      url.searchParams.delete('invitacion'); url.searchParams.delete('compartidos');
      window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
    }
  } catch (e) { /* URL rara: se ignora */ }
}

export const pendingInvite = () => AsyncStorage.getItem(KEY).catch(() => null);
export const clearInvite = () => AsyncStorage.removeItem(KEY).catch(() => {});
// ¿Se abrió la app desde un aviso de gastos compartidos? (solo responde true una vez)
export const takeOpenShared = () => { const v = openShared; openShared = false; return v; };

export function inviteUrl(code) {
  const origin = Platform.OS === 'web' && typeof window !== 'undefined' && /^https?:/.test(window.location.origin) ? window.location.origin : SITE;
  return origin + '/?invitacion=' + code;
}
