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

  // Fondo oscuro desde el primer pintado (evita destello blanco)
  document.documentElement.style.backgroundColor = '#0B1220';
  if (document.body) document.body.style.backgroundColor = '#0B1220';
  if (missing('meta[name="color-scheme"]')) add('meta', { name: 'color-scheme', content: 'dark' });

  // Tipografías del tema "Bóveda nocturna": Inter Tight (texto) e IBM Plex Mono (montos)
  if (missing('link[data-fonts]')) {
    add('link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' });
    add('link', { rel: 'stylesheet', 'data-fonts': '1', href: 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap' });
  }

  // Ícono de la pestaña del navegador
  const favicon = document.head.querySelector('link[rel~="icon"]');
  if (favicon) { favicon.setAttribute('href', '/favicon.png'); favicon.setAttribute('type', 'image/png'); }
  else add('link', { rel: 'icon', href: '/favicon.png', type: 'image/png' });

  if (missing('link[rel="manifest"]')) add('link', { rel: 'manifest', href: '/manifest.json' });
  if (missing('link[rel="apple-touch-icon"]')) add('link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' });
  if (missing('meta[name="apple-mobile-web-app-capable"]')) add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
  if (missing('meta[name="mobile-web-app-capable"]')) add('meta', { name: 'mobile-web-app-capable', content: 'yes' });
  if (missing('meta[name="apple-mobile-web-app-title"]')) add('meta', { name: 'apple-mobile-web-app-title', content: 'Finanzas' });
  if (missing('meta[name="apple-mobile-web-app-status-bar-style"]')) add('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' });
  if (missing('meta[name="theme-color"]')) add('meta', { name: 'theme-color', content: '#0B1220' });

  if ('serviceWorker' in navigator) {
    const register = () => navigator.serviceWorker.register('/sw.js').catch(() => { });
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);
  }
}
