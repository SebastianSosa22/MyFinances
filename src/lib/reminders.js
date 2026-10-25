import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { cardAlerts, cardAlertText } from './accounts';
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

// cards: { accounts, transfers } para avisar el corte y el pago de las tarjetas de crédito
export async function syncReminders(moves, cfg, cards = { accounts: [], transfers: [] }) {
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
    // Tarjetas de crédito: el día del corte, 3 días antes del pago y el día del pago (a la hora elegida)
    if (cfg.cards !== false) {
      for (const al of cardAlerts(cards.accounts, moves, cards.transfers, nowD, 21)) {
        if (count >= 60) break;
        const when = new Date(al.d.getFullYear(), al.d.getMonth(), al.d.getDate(), cfg.hour, 0, 0);
        if (when <= nowD) continue;
        await Notifications.scheduleNotificationAsync({ content: cardAlertText(al, (v) => money(v, true)), trigger: { type: 'date', date: when } });
        count++;
      }
    }
    if (cfg.daily) await Notifications.scheduleNotificationAsync({ content: { title: 'Finanzas', body: '¿Ya registraste tus gastos de hoy?' }, trigger: { type: 'daily', hour: 21, minute: 0 } });
  } catch (e) { /* sin permiso o no disponible */ }
}
