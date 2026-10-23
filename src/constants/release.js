// Aviso de novedades: se muestra UNA sola vez por dispositivo a los usuarios que ya tenían cuenta.
// Para anunciar otra versión: cambia `id`, los textos y la fecha `cutoff`, y publica.
// Si no hay pasos que seguir, deja `steps` vacío y no se muestra la sección de instalación.
export const RELEASE = {
  id: '2026-10-calendario',
  cutoff: '2026-10-23', // solo lo ven las cuentas creadas antes de esta fecha (usa el día en que publiques)
  title: 'Novedades en tu app 🎉',
  highlights: [
    '📅 Calendario en Movimientos: los días con movimientos se colorean (punto verde = ingreso, rojo = gasto). Toca un día para ver solo lo de ese día.',
    '👋 Ahora te saludamos por tu nombre en el Resumen. Escríbelo en Ajustes → Cuenta.',
    '🏠 Tu renta se reparte entre los días que cubre, así tu semana no se ve "rota" el día que la pagas.',
    '📊 Resumen más claro: un solo "Puedes gastar hoy", avisos por categoría y tu tasa de ahorro real.',
    '🌙 Nuevo diseño oscuro, más limpio y fácil de leer.',
  ],
  stepsTitle: '',
  steps: [],
  androidNote: '',
  note: 'No tienes que hacer nada: tus datos siguen guardados en tu cuenta. Solo agrega tu nombre en Ajustes para que te saludemos.',
};
