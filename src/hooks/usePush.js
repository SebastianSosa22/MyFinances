import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { disablePush, enablePush, getPushStatus, updatePushPrefs } from '../lib/push';
import { track, trackError } from '../lib/analytics';

// Estado y acciones de las notificaciones push (solo web). `prefs` son las preferencias de recordatorios.
export function usePush(prefs) {
  const [status, setStatus] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (Platform.OS === 'web') getPushStatus().then(setStatus).catch(() => setStatus('unsupported'));
    else setStatus('unsupported');
  }, []);

  // Si cambias tus preferencias, se actualizan en el servidor
  useEffect(() => { if (status === 'enabled') updatePushPrefs(prefs).catch(() => {}); }, [status, prefs]);

  const run = async (fn) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { trackError(e, 'push'); setError('No se pudo completar: ' + (e instanceof Error ? e.message : String(e))); }
    setBusy(false);
  };
  const enable = () => run(async () => { setStatus(await enablePush(prefs)); track('push_enable'); });
  const disable = () => run(async () => { await disablePush(); setStatus('ready'); track('push_disable'); });

  return { status, busy, error, enable, disable };
}
