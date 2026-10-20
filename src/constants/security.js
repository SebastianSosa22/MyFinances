// Cierre automático de sesión por inactividad
export const IDLE_OPTIONS = { 5: { label: '5 min' }, 15: { label: '15 min' }, 30: { label: '30 min' }, 60: { label: '1 hora' } };
export const DEFAULT_IDLE_MINUTES = 15;
export const WARNING_SECONDS = 60; // aviso antes de cerrar la sesión
