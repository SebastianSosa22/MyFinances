import { Platform } from 'react-native';

// Hace la web instalable (manifiesto, ícono, modo pantalla completa) y registra el service worker de las notificaciones
export function setupPwa() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const add = (tag, attrs) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    document.head.appendChild(el);
  };
  const missing = (selector) => !document.head.querySelector(selector);

  if (missing('link[rel="manifest"]')) add('link', { rel: 'manifest', href: '/manifest.json' });
  if (missing('link[rel="apple-touch-icon"]')) add('link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' });
  if (missing('meta[name="apple-mobile-web-app-capable"]')) add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
  if (missing('meta[name="mobile-web-app-capable"]')) add('meta', { name: 'mobile-web-app-capable', content: 'yes' });
  if (missing('meta[name="apple-mobile-web-app-title"]')) add('meta', { name: 'apple-mobile-web-app-title', content: 'Finanzas' });
  if (missing('meta[name="apple-mobile-web-app-status-bar-style"]')) add('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'default' });
  if (missing('meta[name="theme-color"]')) add('meta', { name: 'theme-color', content: '#F2F2F7' });

  if ('serviceWorker' in navigator) {
    const register = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);
  }
}
