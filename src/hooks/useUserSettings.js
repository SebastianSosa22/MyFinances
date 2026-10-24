import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { DEFAULT_SPLIT, applySplit } from '../constants/budget';
import { track } from '../lib/analytics';

const DEFAULTS = { cycle: 'weekly', reservePct: 0, payDay: 1, split: DEFAULT_SPLIT, onboarded: false };

// Ajustes de la cuenta: se guardan en Supabase (para verlos en todos tus dispositivos) y en una copia local.
// Devuelve [ajustes, guardar, cargados]; `cargados` es true cuando ya se consultó la cuenta.
export function useUserSettings(session) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const remote = useRef(false); // la copia local solo sirve mientras no llegan los datos de la cuenta

  useEffect(() => {
    AsyncStorage.getItem('user_settings').then((raw) => { if (raw && !remote.current) setSettings({ ...DEFAULTS, ...JSON.parse(raw) }); });
    supabase.from('user_settings').select('*').maybeSingle().then(({ data }) => {
      remote.current = true;
      if (data) setSettings({ cycle: data.cycle, reservePct: data.reserve_pct, payDay: data.pay_day ?? 1, split: data.split || DEFAULT_SPLIT, onboarded: !!data.onboarded });
      setLoaded(true);
    });
  }, []);

  // El reparto elegido (50/30/20, 60/20/20...) se aplica antes de dibujar cualquier pantalla
  applySplit(settings.split);

  const saveSettings = async (patch) => {
    const next = { ...settings, ...patch };
    Object.keys(patch).forEach((k) => { if (k !== 'onboarded') track('settings_change', { key: k, value: String(patch[k]) }); });
    setSettings(next);
    AsyncStorage.setItem('user_settings', JSON.stringify(next));
    const { error } = await supabase.from('user_settings').upsert({
      user_id: session.user.id, cycle: next.cycle, reserve_pct: next.reservePct, pay_day: next.payDay, split: next.split, onboarded: next.onboarded,
    });
    return !error;
  };

  return [settings, saveSettings, loaded];
}
