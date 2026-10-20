import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RELEASE } from '../constants/release';

// Decide si mostrar el aviso de novedades: solo en web, solo a cuentas anteriores a la fecha de corte
// y solo una vez por dispositivo (se recuerda con la clave 'release_seen').
export function useReleaseNotice(session) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const existingUser = new Date(session.user.created_at) < new Date(RELEASE.cutoff + 'T00:00:00');
    if (!existingUser) return;
    AsyncStorage.getItem('release_seen').then((seen) => { if (seen !== RELEASE.id) setVisible(true); });
  }, []);

  const dismiss = () => {
    setVisible(false);
    AsyncStorage.setItem('release_seen', RELEASE.id);
  };

  return { visible, dismiss };
}
