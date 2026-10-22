export const BUCKETS = {
  needs: { label: 'Necesidades', pct: 50, color: '#007AFF' },
  wants: { label: 'Deseos', pct: 30, color: '#FF9500' },
  savings: { label: 'Ahorro', pct: 20, color: '#34C759' },
};

// Reparto del presupuesto que cada usuario puede elegir en Ajustes (se guarda en su cuenta)
export const SPLITS = {
  '50-30-20': { label: '50/30/20', hint: 'El clásico: equilibrado.' },
  '60-20-20': { label: '60/20/20', hint: 'Si tus gastos fijos pesan más.' },
  '70-20-10': { label: '70/20/10', hint: 'Para ingresos ajustados.' },
  '40-30-30': { label: '40/30/30', hint: 'Prioridad al ahorro.' },
};
export const DEFAULT_SPLIT = '50-30-20';

// Cambia los porcentajes de BUCKETS según el reparto elegido (todas las pantallas leen BUCKETS al dibujarse)
export function applySplit(key) {
  const [n, w, sv] = (SPLITS[key] ? key : DEFAULT_SPLIT).split('-').map(Number);
  BUCKETS.needs.pct = n;
  BUCKETS.wants.pct = w;
  BUCKETS.savings.pct = sv;
}

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

// Frecuencias para ingresos (nómina u otros ingresos que se repiten)
export const INCOME_FREQ = { once: 'Una vez', weekly: 'Semanal', biweekly: 'Cada 2 sem.', monthly: 'Mensual' };

export const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

// Ciclo en que el usuario recibe su ingreso (define cuándo "cierra" la caja de ahorro)
export const CYCLES = {
  weekly: { label: 'Semanal', this: 'esta semana' },
  biweekly: { label: 'Quincenal', this: 'esta quincena' },
  monthly: { label: 'Mensual', this: 'este mes' },
};
