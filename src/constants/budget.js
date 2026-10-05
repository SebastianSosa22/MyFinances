export const BUCKETS = {
  needs: { label: 'Necesidades', pct: 50, color: '#007AFF' },
  wants: { label: 'Deseos', pct: 30, color: '#FF9500' },
  savings: { label: 'Ahorro', pct: 20, color: '#34C759' },
};

export const CATS = [
  { name: 'Renta', icon: '🏠', bucket: 'needs' }, { name: 'Comida', icon: '🛒', bucket: 'needs' },
  { name: 'Transporte', icon: '🚌', bucket: 'needs' }, { name: 'Servicios', icon: '💡', bucket: 'needs' },
  { name: 'Salud', icon: '🩺', bucket: 'needs' },
  { name: 'Restaurantes', icon: '🍔', bucket: 'wants' }, { name: 'Ocio', icon: '🎬', bucket: 'wants' },
  { name: 'Compras', icon: '🛍️', bucket: 'wants' }, { name: 'Suscripciones', icon: '📺', bucket: 'wants' },
  { name: 'Ahorro', icon: '🐷', bucket: 'savings' }, { name: 'Inversión', icon: '📈', bucket: 'savings' },
  { name: 'Deudas', icon: '💳', bucket: 'savings' },
];

export const PERIODS = { weekly: { label: 'Semana', div: 52 / 12 }, biweekly: { label: 'Quincena', div: 2 }, monthly: { label: 'Mes', div: 1 } };

export const EFREQ = { once: 'Una vez', weekly: 'Semanal', biweekly: 'Cada 2 sem.', monthly: 'Mensual', yearly: 'Anual' };

export const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
