// Pestañas de la app (las usan la barra inferior del móvil y la barra lateral de escritorio)
// "Ahorro" agrupa la Caja de ahorro y las Metas (se cambia con un selector dentro de la pestaña)
export const TABS = [
  { key: 'home', icon: '📊', label: 'Resumen' },
  { key: 'moves', icon: '🧾', label: 'Movimientos' },
  { key: 'savings', icon: '🐷', label: 'Ahorro' },
  { key: 'history', icon: '🗓️', label: 'Historial' },
  { key: 'settings', icon: '⚙️', label: 'Ajustes' },
];

// Pestaña extra que solo ven las cuentas con rol de administrador
export const ADMIN_TAB = { key: 'admin', icon: '📈', label: 'Admin' };
