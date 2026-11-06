import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

const MIN_MS = 2800; // tiempo mínimo desde que se abre la app, para que la animación se vea completa
const FADE_MS = 500;

// La pantalla de carga con el logo animado está en public/index.html (#boot), fuera de la app de React,
// así la animación arranca en cuanto abre la página y no se reinicia cuando carga el código.
// Este componente solo decide cuándo quitarla: cuando la app está lista (ready) y pasó el tiempo mínimo.
export function SplashScreen({ ready, onDone }) {
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; }, [onDone]);
  useEffect(() => {
    if (!ready) return undefined;
    const el = Platform.OS === 'web' && typeof document !== 'undefined' ? document.getElementById('boot') : null;
    if (!el) { done.current(); return undefined; }
    const since = typeof performance !== 'undefined' ? performance.now() : MIN_MS;
    let fade;
    const hold = setTimeout(() => {
      el.classList.add('hide');
      fade = setTimeout(() => { el.remove(); done.current(); }, FADE_MS);
    }, Math.max(0, MIN_MS - since));
    return () => { clearTimeout(hold); clearTimeout(fade); };
  }, [ready]);
  return null;
}
