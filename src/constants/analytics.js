// Nombres en español para el panel de administrador (pantallas, acciones, métricas y plataformas)

export const SCREEN_LABELS = {
  home: 'Resumen',
  moves: 'Movimientos',
  savings_box: 'Caja de ahorro',
  savings_goals: 'Metas',
  history: 'Historial',
  settings: 'Ajustes',
  admin: 'Admin',
};

export const ACTION_LABELS = {
  movement_add: 'Registrar movimiento',
  movement_edit: 'Editar movimiento',
  movement_delete: 'Borrar movimiento',
  movement_undo: 'Deshacer borrado',
  goal_create: 'Crear meta',
  goal_edit: 'Editar meta',
  goal_delete: 'Borrar meta',
  goal_contribute: 'Aportar a meta',
  limit_set: 'Poner límite de categoría',
  limit_remove: 'Quitar límite',
  limits_apply_suggested: 'Aplicar límites sugeridos',
  settings_change: 'Cambiar ajustes',
  push_enable: 'Activar notificaciones',
  push_disable: 'Desactivar notificaciones',
  export_csv: 'Exportar CSV',
  onboarding_done: 'Completar bienvenida',
  onboarding_skip: 'Saltar bienvenida',
};

// good: hasta aquí se siente rápido; ok: aceptable; más que ok se marca como lento
export const PERF_METRICS = {
  app_start: { label: 'Arranque de la app', good: 2500, ok: 5000 },
  data_load: { label: 'Carga de datos', good: 800, ok: 2000 },
  save_movement: { label: 'Guardar movimiento', good: 600, ok: 1500 },
  admin_load: { label: 'Carga del panel', good: 1500, ok: 4000 },
};

export const PLATFORM_LABELS = {
  'ios-pwa': 'iPhone (app instalada)',
  'ios-web': 'iPhone (Safari)',
  'android-pwa': 'Android (app instalada)',
  'android-web': 'Android (navegador)',
  'desktop-pwa': 'Computadora (app instalada)',
  'web-desktop': 'Computadora (navegador)',
  'ios-app': 'iOS nativa',
  'android-app': 'Android nativa',
};

export const SOURCE_LABELS = { app: 'Manual en la app', shortcut: 'Atajos de iPhone', auto: 'Automático' };

export const RANGES = { 7: { label: '7 días' }, 30: { label: '30 días' }, 90: { label: '90 días' } };

export const ADMIN_VIEWS = {
  overview: { label: 'Resumen' },
  users: { label: 'Usuarios' },
  usage: { label: 'Uso' },
  perf: { label: 'Rendimiento' },
};
