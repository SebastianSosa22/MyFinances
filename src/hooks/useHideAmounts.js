import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'hide_amounts';

// Ocultar montos (el ojo junto al saludo). Se recuerda en el dispositivo.
export function useHideAmounts() {
  const [hide, setHide] = useState(false);
  useEffect(() => { AsyncStorage.getItem(KEY).then((v) => setHide(v === '1')).catch(() => {}); }, []);
  const toggle = () => setHide((h) => { AsyncStorage.setItem(KEY, h ? '0' : '1').catch(() => {}); return !h; });
  return [hide, toggle];
}
