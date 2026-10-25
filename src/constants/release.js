// Aviso de novedades: se muestra UNA sola vez por dispositivo a los usuarios que ya tenían cuenta.
// Para anunciar otra versión: cambia `id`, los textos y la fecha `cutoff`, y publica.
// Si no hay pasos que seguir, deja `steps` vacío y no se muestra la sección de instalación.
export const RELEASE = {
  id: '2026-10-boveda-nocturna',
  cutoff: '2026-10-25', // solo lo ven las cuentas creadas antes de esta fecha (usa el día en que publiques)
  title: 'Tu app se renovó 🌙',
  highlights: [
    '🌙 Nuevo diseño "Bóveda nocturna": colores más tranquilos y montos más fáciles de leer.',
    '🏠 Inicio renovado: tu dinero Disponible del periodo, tu reparto 50/30/20, tus cuentas, tu caja de ahorro y los pagos de los próximos 7 días, todo a la vista.',
    '➕ Registrar es más rápido: elige la categoría con un toque, marca si se repite (semanal, mensual o anual) y revisa cuenta y fecha antes de guardar.',
    '🧾 Movimientos con buscador, filtro de Recurrentes y lo que entró y salió en el mes.',
    '📊 Análisis: tu gasto día por día y en qué categorías se va más tu dinero.',
    '🎯 Presupuestos con una marca que te dice si vas a buen ritmo, y metas de ahorro con tu Fondo de emergencia.',
    '💳 En Tus cuentas, transfiere o paga tu tarjeta en un toque.',
    '⚙️ Elige tu reparto (50/30/20, 60/20/20, 70/20/10 o 40/30/30) en Ajustes → Tu dinero.',
  ],
  stepsTitle: '',
  steps: [],
  androidNote: '',
  note: 'No tienes que hacer nada: tus datos siguen guardados en tu cuenta. Si quieres repasar dónde quedó cada cosa, abre Ajustes → Ver la guía de la app.',
};
