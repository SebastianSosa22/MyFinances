// En la web no hay notificaciones locales (se usan las push del service worker, ver push.js).
// Este archivo evita cargar expo-notifications en el paquete web, que así descarga y arranca más rápido.
const no = async () => ({ granted: false });
export const setNotificationHandler = () => {};
export const getPermissionsAsync = no;
export const requestPermissionsAsync = no;
export const cancelAllScheduledNotificationsAsync = async () => {};
export const scheduleNotificationAsync = async () => null;
