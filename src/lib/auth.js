export const MIN_PASSWORD = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Devuelve un mensaje de error en español, o '' si los datos son válidos
export function validateCredentials({ email, password, confirm, isSignUp }) {
    if (!EMAIL_RE.test(email.trim())) return 'Escribe un correo válido.';
    if (!password) return 'Escribe tu contraseña.';
    if (!isSignUp) return '';
    if (password.length < MIN_PASSWORD) return 'La contraseña debe tener al menos ' + MIN_PASSWORD + ' caracteres.';
    if (password !== confirm) return 'Las contraseñas no coinciden.';
    return '';
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