import { AppState, Platform } from 'react-native';
import { supabase } from './supabase';

// Bitácora de uso: registra qué pantallas y funciones se usan, tiempos de carga y errores.
// Solo guarda conteos y nombres de acciones (nunca montos ni notas). Lo ve únicamente un administrador.
// Los eventos se juntan y se envían en lotes para no gastar datos ni hacer lenta la app.

const FLUSH_MS = 10000;
const MAX_BATCH = 20;
const MAX_ERRORS = 5; // por sesión, para no llenar la bitácora si algo falla en bucle

const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const bootAt = Date.now();
let userId = null;
let queue = [];
let timer = null;
let errors = 0;
let currentScreen = null;
let installed = false;

// Plataforma en texto corto: ios-app, android-app, ios-pwa, ios-web, android-web, web-desktop...
export function platformTag() {
  if (Platform.OS !== 'web') return Platform.OS + '-app';
  if (typeof navigator === 'undefined') return 'web';
  const ua = navigator.userAgent || '';
  const os = /iPhone|iPad|iPod/.test(ua) ? 'ios' : /Android/.test(ua) ? 'android' : 'desktop';
  const standalone = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
  if (os === 'desktop') return standalone ? 'desktop-pwa' : 'web-desktop';
  return os + (standalone ? '-pwa' : '-web');
}

const PLATFORM = platformTag();

async function flush() {
  clearTimeout(timer); timer = null;
  if (!userId || !queue.length) return;
  const batch = queue.splice(0, MAX_BATCH);
  const { error } = await supabase.from('app_events').insert(batch.map((e) => ({ ...e, user_id: userId })));
  if (error) queue = []; // si la tabla no responde, se descarta: la bitácora nunca debe afectar el uso de la app
  else if (queue.length) flush();
}

const schedule = () => { if (!timer) timer = setTimeout(flush, FLUSH_MS); };

// Registra una acción. `props` debe llevar solo datos no sensibles (tipo, categoría, frecuencia...)
export function track(name, props = {}, screen = currentScreen) {
  if (!userId) return;
  queue.push({ session_id: sessionId, name, screen, props, platform: PLATFORM, created_at: new Date().toISOString() });
  if (queue.length >= MAX_BATCH) flush(); else schedule();
}

export function trackScreen(screen) {
  if (screen === currentScreen) return;
  currentScreen = screen;
  track('screen_view', {}, screen);
}

// Tiempo (ms) que tardó algo: app_start, data_load, admin_load...
export function trackPerf(metric, ms, extra = {}) {
  if (!Number.isFinite(ms) || ms < 0) return;
  track('perf', { metric, ms: Math.round(ms), ...extra });
}

export function trackError(err, where) {
  if (errors >= MAX_ERRORS) return;
  errors += 1;
  const message = String((err && (err.message || err.reason)) || err || 'Error').slice(0, 300);
  track('error', { message, where: where || null });
}

// Mide el tiempo de una promesa y lo registra
export async function timed(metric, fn, extra) {
  const t0 = Date.now();
  try { return await fn(); } finally { trackPerf(metric, Date.now() - t0, extra); }
}

function installHandlers() {
  if (installed) return;
  installed = true;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('error', (e) => trackError(e.error || e.message, 'window'));
    window.addEventListener('unhandledrejection', (e) => trackError(e.reason, 'promise'));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  } else if (global.ErrorUtils) {
    const prev = global.ErrorUtils.getGlobalHandler();
    global.ErrorUtils.setGlobalHandler((e, fatal) => { trackError(e, fatal ? 'fatal' : 'global'); flush(); prev && prev(e, fatal); });
  }
  AppState.addEventListener('change', (st) => { if (st !== 'active') flush(); });
}

// Se llama al tener sesión: activa la bitácora, registra la apertura y el tiempo de arranque
export function startAnalytics(user) {
  if (!user || userId === user.id) return;
  userId = user.id;
  installHandlers();
  track('app_open', {}, null);
  trackPerf('app_start', Date.now() - bootAt);
  supabase.rpc('touch_last_seen').then(() => {}, () => {});
}

export function stopAnalytics() {
  flush();
  userId = null;
  currentScreen = null;
}
