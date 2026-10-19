import { Platform } from 'react-native';
import { supabase } from './supabase';
import { VAPID_PUBLIC_KEY } from './pushConfig';

const isWeb = Platform.OS === 'web';
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;

function keyToBytes(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

// 'unsupported' | 'needs-install' | 'not-configured' | 'denied' | 'ready' | 'enabled'
export async function getPushStatus() {
  if (!isWeb) return 'unsupported';
  // En iPhone solo hay push dentro de la app añadida a la pantalla de inicio
  if (isIOS() && !isStandalone()) return 'needs-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (VAPID_PUBLIC_KEY.startsWith('PEGA_')) return 'not-configured';
  if (Notification.permission === 'denied') return 'denied';
  const sub = await currentSubscription();
  return sub && Notification.permission === 'granted' ? 'enabled' : 'ready';
}

// Pide permiso, crea la suscripción de este dispositivo y la guarda en Supabase junto con las preferencias
export async function enablePush(prefs) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'ready';
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) }));
  const json = sub.toJSON();
  const keys = json.keys || {};
  const { error } = await supabase.from('push_subscriptions').upsert(
    { endpoint: json.endpoint, p256dh: keys.p256dh, auth: keys.auth, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, prefs },
    { onConflict: 'endpoint' }
  );
  if (error) throw error;
  return 'enabled';
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

export async function updatePushPrefs(prefs) {
  const sub = await currentSubscription();
  if (sub) await supabase.from('push_subscriptions').update({ prefs, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }).eq('endpoint', sub.endpoint);
}

// Notificación local de prueba (comprueba que el permiso y el service worker funcionan)
export async function showTestNotification() {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('Finanzas', { body: 'Así se verán tus avisos 🎉', icon: '/icon-192.png' });
}
