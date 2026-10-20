// Aviso de novedades: se muestra UNA sola vez por dispositivo a los usuarios que ya tenían cuenta.
// Para anunciar otra versión: cambia `id`, los textos y la fecha `cutoff`, y publica.
export const RELEASE = {
  id: '2026-10-novedades-push-icono',
  cutoff: '2026-10-21', // solo lo ven las cuentas creadas antes de esta fecha (usa el día en que publiques)
  title: 'Novedades de la app 🎉',
  highlights: [
    '🐷 Caja de ahorro: lo que no gastas cada ciclo pasa solo a tu ahorro.',
    '🎯 Metas y límites por categoría, con avisos cuando te acerques al tope.',
    '🔔 Notificaciones de tus pagos y del cierre de tu ciclo.',
    '🗓️ Historial mensual y un Resumen más completo, con nuevo ícono.',
  ],
  stepsTitle: 'Para ver el nuevo ícono y activar las notificaciones (iPhone):',
  steps: [
    'Borra el ícono actual de la pantalla de inicio: mantenlo presionado y elige Eliminar app.',
    'Abre Safari y entra a la dirección de abajo.',
    'Toca Compartir y luego "Añadir a pantalla de inicio".',
    'Abre la app desde el ícono nuevo, inicia sesión y activa las notificaciones en Ajustes.',
  ],
  androidNote: 'En Android o computadora: menú del navegador > Instalar app.',
  note: 'No es obligatorio para seguir usando la app, y no pierdes nada: tus datos están guardados en tu cuenta.',
};
