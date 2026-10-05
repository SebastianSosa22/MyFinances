import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { asExp, occurrences } from './finance';
import { money } from './format';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

export async function ensurePerm() {
  if (Platform.OS === 'web') return false;
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return !!req.granted;
}

export async function syncReminders(moves, cfg) {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const nowD = new Date();
    let count = 0;
    if (cfg.on) {
      const rec = moves.filter((m) => m.kind === 'expense' && m.freq && m.freq !== 'once');
      for (let i = 0; i <= 21 && count < 50; i++) {
        const d = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate() + i);
        for (const m of rec) {
          if (occurrences(asExp(m), d, d) === 0) continue;
          const when = new Date(d.getFullYear(), d.getMonth(), d.getDate() - cfg.before, cfg.hour, 0, 0);
          if (when <= nowD) continue;
          await Notifications.scheduleNotificationAsync({
            content: {
              title: cfg.before ? 'Pago próximo' : 'Pago de hoy',
              body: (m.note || m.cat) + ' · ' + money(m.amount, true) + (cfg.before ? ' · ' + d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' }) : ''),
            },
            trigger: { type: 'date', date: when },
          });
          count++;
        }
      }
    }
    if (cfg.daily) await Notifications.scheduleNotificationAsync({ content: { title: 'Finanzas', body: '¿Ya registraste tus gastos de hoy?' }, trigger: { type: 'daily', hour: 21, minute: 0 } });
  } catch (e) { /* sin permiso o no disponible */ }
}
