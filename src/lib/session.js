import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export const CACHE_PREFIX = 'cache_';

// Borra la copia local de tus datos (se usa al cerrar sesión para no dejar información financiera en el dispositivo)
export async function clearCachedData() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (mine.length) await AsyncStorage.multiRemove(mine);
  } catch (e) { /* no pasa nada si no se pudo */ }
}

// Cierra la sesión solo en ESTE dispositivo (las demás sesiones del usuario siguen abiertas)
export async function signOutLocal() {
  await clearCachedData();
  await supabase.auth.signOut({ scope: 'local' });
}
