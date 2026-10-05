import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensurePerm, syncReminders } from '../lib/reminders';

const DEFAULT_REMINDERS = { on: false, daily: false, before: 1, hour: 9 };

// Preferencias de recordatorios (se guardan en este teléfono) y programación de las notificaciones
export function useReminders(moves, onNotice) {
  const [rem, setRem] = useState(DEFAULT_REMINDERS);

  useEffect(() => { AsyncStorage.getItem('reminders').then((raw) => { if (raw) setRem(JSON.parse(raw)); }); }, []);
  useEffect(() => { syncReminders(moves, rem); }, [moves, rem]);

  const setReminders = async (cfg) => {
    const turningOn = (cfg.on && !rem.on) || (cfg.daily && !rem.daily);
    if (turningOn && !(await ensurePerm())) {
      onNotice('Activa las notificaciones de esta app en Ajustes del iPhone para recibir recordatorios.');
      return;
    }
    setRem(cfg);
    AsyncStorage.setItem('reminders', JSON.stringify(cfg));
  };

  return [rem, setReminders];
}
