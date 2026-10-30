import { AppState, Platform } from 'react-native';
import { supabase } from './supabase';

// Bitácora de uso: registra qué pantallas y funciones se usan, tiempos de carga y errores.
// Solo guarda conteos y nombres de acciones (nunca montos ni notas). Lo ve únicamente un administrador.
// Los eventos se juntan y se envían en lotes para no gastar datos ni hacer lenta la app.

const FLUSH_MS = 10000;
const MAX_BATCH = 20;
const MAX_ERRORS = 5; // por sesión, para no llenar la bitácora si algo falla en bucle
// En desarrollo (expo start) no se registra nada: los errores de código a medio escribir no son errores de los usuarios
const ENABLED = typeof __DEV__ === 'undefined' || !__DEV__;

const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const bootAt = Date.now();
let userId = null;
let queue = [];
let timer = null;
let errors = 0;
let currentScreen = null;
let installed = false;
let restored = false; // la sesión ya estaba guardada al abrir (sin pasar por el inicio de sesión)
let wasHidden = false; // la app se fue a segundo plano antes de terminar de abrir
let readySent = false;

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

// Desde el primer momento: si la app pasa a segundo plano mientras abre, ese arranque no se mide
// (el reloj sigue corriendo con la app guardada y daría tiempos falsos)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  if (document.visibilityState === 'hidden') wasHidden = true;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') wasHidden = true; });
}
AppState.addEventListener('change', (st) => { if (st === 'background') wasHidden = true; });

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
  if (!userId || !ENABLED) return;
  queue.push({ session_id: sessionId, name, screen, props, platform: PLATFORM, created_at: new Date().toISOString() });
  if (queue.length >= MAX_BATCH) flush(); else schedule();
}

export function trackScreen(screen) {
  if (screen === currentScreen) return;
  currentScreen = screen;
  track('screen_view', {}, screen);
}

const MAX_PERF_MS = 120000; // más de 2 min no es una carga: la app se quedó en espera y el dato engañaría

// Tiempo (ms) que tardó algo: app_ready, data_load, admin_load...
export function trackPerf(metric, ms, extra = {}) {
  if (!Number.isFinite(ms) || ms < 0 || ms > MAX_PERF_MS) return;
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

// Milisegundos desde que se empezó a abrir la app. En web cuenta desde que el navegador pidió la página,
// así incluye la descarga del código (lo que de verdad espera el usuario).
const sinceBoot = () => (Platform.OS === 'web' && typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now() - bootAt);

// Se llama al tener sesión: activa la bitácora y registra la apertura.
// `wasRestored`: la sesión ya estaba guardada (abrir la app), no un inicio de sesión recién hecho.
export function startAnalytics(user, wasRestored = false) {
  if (!user || userId === user.id) return;
  userId = user.id;
  restored = wasRestored;
  installHandlers();
  track('app_open', {}, null);
  if (ENABLED) supabase.rpc('touch_last_seen').then(() => {}, () => {});
}

// Se llama cuando el usuario ya ve sus datos (copia local o frescos): mide el arranque real, una vez por apertura.
// Solo cuenta aperturas con sesión guardada y sin pasar a segundo plano; antes se medía hasta iniciar sesión
// (incluía lo que tardabas en escribir la contraseña) y salían arranques falsos de varios minutos.
export function markReady() {
  if (readySent || !userId) return;
  readySent = true;
  if (restored && !wasHidden) trackPerf('app_ready', sinceBoot());
}

export function stopAnalytics() {
  flush();
  userId = null;
  currentScreen = null;
}
