import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const DEFAULTS = { cycle: 'weekly', reservePct: 0 };

// Ajustes de la cuenta: se guardan en Supabase (para verlos en todos tus dispositivos) y en una copia local
export function useUserSettings(session) {
  const [settings, setSettings] = useState(DEFAULTS);

  useEffect(() => {
    AsyncStorage.getItem('user_settings').then((raw) => { if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) }); });
    supabase.from('user_settings').select('*').maybeSingle().then(({ data }) => {
      if (data) setSettings({ cycle: data.cycle, reservePct: data.reserve_pct });
    });
  }, []);

  const saveSettings = async (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    AsyncStorage.setItem('user_settings', JSON.stringify(next));
    await supabase.from('user_settings').upsert({ user_id: session.user.id, cycle: next.cycle, reserve_pct: next.reservePct });
  };

  return [settings, saveSettings];
}
