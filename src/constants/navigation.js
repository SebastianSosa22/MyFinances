// Pestañas de la app (las usan la barra inferior del móvil y la barra lateral de escritorio)
// "Presupuestos" agrupa los presupuestos por categoría y el Ahorro con las metas (se cambia con un selector dentro de la pestaña)
export const TABS = [
  // glyph: ícono de línea (components/Icon) que usa la barra inferior
  { key: 'home', icon: '📊', glyph: 'home', label: 'Inicio' },
  { key: 'moves', icon: '🧾', glyph: 'list', label: 'Movimientos' },
  { key: 'history', icon: '🗓️', glyph: 'pie', label: 'Análisis' },
  { key: 'savings', icon: '🛍️', glyph: 'bag', label: 'Presupuestos' },
  { key: 'settings', icon: '⚙️', label: 'Ajustes' },
];

// Pestaña extra que solo ven las cuentas con rol de administrador
export const ADMIN_TAB = { key: 'admin', icon: '📈', label: 'Admin' };
