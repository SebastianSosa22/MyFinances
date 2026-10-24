export const MIN_PASSWORD = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Devuelve un mensaje de error en español, o '' si los datos son válidos
export function validateCredentials({ name, email, password, confirm, isSignUp }) {
  if (isSignUp && !(name || '').trim()) return 'Escribe tu nombre.';
  if (!EMAIL_RE.test(email.trim())) return 'Escribe un correo válido.';
  if (!password) return 'Escribe tu contraseña.';
  if (!isSignUp) return '';
  if (password.length < MIN_PASSWORD) return 'La contraseña debe tener al menos ' + MIN_PASSWORD + ' caracteres.';
  if (password !== confirm) return 'Las contraseñas no coinciden.';
  return '';
}

// Registro por pasos (0 nombre, 1 correo, 2 contraseña): valida solo el paso actual
export function validateSignUpStep(step, { name, email, password, confirm }) {
  if (step === 0) return (name || '').trim() ? '' : 'Escribe tu nombre.';
  if (step === 1) return EMAIL_RE.test(email.trim()) ? '' : 'Escribe un correo válido.';
  return validateCredentials({ name, email, password, confirm, isSignUp: true });
}

// Nombre con el que saludamos (solo el primero); '' si la cuenta aún no tiene nombre
export function firstName(user) {
  const full = ((user && user.user_metadata && user.user_metadata.full_name) || '').trim();
  return full.split(/\s+/)[0] || '';
}

// Iniciales para el círculo de perfil: nombre y apellido, o las dos primeras letras del correo
export function initials(user) {
  const parts = ((user.user_metadata && user.user_metadata.full_name) || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length) return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  return (user.email || '?').slice(0, 2).toUpperCase();
}

// Traduce los errores de Supabase Auth
export function authErrorMessage(error) {
  const m = (error.message || '').toLowerCase();
  if (m.includes('invalid login')) return 'Correo o contraseña incorrectos.';
  if (m.includes('already registered')) return 'Ese correo ya tiene una cuenta. Inicia sesión.';
  if (m.includes('not confirmed')) return 'Confirma tu correo antes de iniciar sesión.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'El registro de cuentas nuevas está desactivado.';
  if (m.includes('password')) return 'La contraseña no es válida. Usa al menos ' + MIN_PASSWORD + ' caracteres.';
  return 'No se pudo completar: ' + error.message;
}
