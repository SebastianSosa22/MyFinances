// Aviso de novedades: se muestra UNA sola vez por dispositivo a los usuarios que ya tenían cuenta.
// Para anunciar otra versión: cambia `id`, los textos y la fecha `cutoff`, y publica.
// Si no hay pasos que seguir, deja `steps` vacío y no se muestra la sección de instalación.
export const RELEASE = {
  id: '2026-10-personalizacion',
  cutoff: '2026-10-21', // solo lo ven las cuentas creadas antes de esta fecha (usa el día en que publiques)
  title: 'Nuevo: la app se adapta a ti ✨',
  highlights: [
    '💵 Nómina automática: registra tu ingreso una vez y se cuenta solo cada semana, quincena o mes. Elige tu día de cobro en Ajustes.',
    '🎯 Elige tu reparto: 50/30/20, 60/20/20, 70/20/10 o 40/30/30.',
    '💡 Sugerencias que aprenden de tus gastos, "Puedes gastar hoy" y avisos "Para ti".',
    '✏️ Toca un movimiento para editarlo, elige su fecha y deshaz si lo borras por error.',
    '🔁 Termina un pago recurrente (como una suscripción) sin perder su historial.',
    '📤 Exporta tus movimientos a CSV y recupera tu contraseña desde el login.',
  ],
  stepsTitle: '',
  steps: [],
  androidNote: '',
  note: 'No tienes que hacer nada: tus datos siguen guardados en tu cuenta. Puedes ajustar todo en la pestaña Ajustes.',
};
