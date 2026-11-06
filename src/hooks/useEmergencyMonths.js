import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMERGENCY_DEFAULT, EMERGENCY_OPTS } from '../lib/emergency';

const EMERGENCY_KEY = 'emergency_months';

// Meses que quieres cubrir con tu fondo de emergencia (se recuerda en el dispositivo).
// Una sola fuente para Salud financiera y para Ahorro y metas.
export function useEmergencyMonths() {
  const [months, setMonths] = useState(EMERGENCY_DEFAULT);
  useEffect(() => { AsyncStorage.getItem(EMERGENCY_KEY).then((v) => { if (EMERGENCY_OPTS.includes(Number(v))) setMonths(Number(v)); }).catch(() => {}); }, []);
  const save = (n) => { setMonths(n); AsyncStorage.setItem(EMERGENCY_KEY, String(n)).catch(() => {}); };
  return [months, save];
}
