import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

// Guía interactiva: oscurece la pantalla, ilumina un elemento y explica para qué sirve.
// Cada elemento se marca con useTourRef('id') (o <TourTarget id>) y la guía lo busca por su id.
// fixed: el elemento no se mueve con el scroll (barra de abajo, menú lateral, encabezado).
export const TOUR_STEPS = [
  { target: 'hero', title: 'Lo que tienes disponible', body: 'Lo que te queda en el periodo, lo que entró y lo que has gastado. Tócala para ver el análisis.' },
  { target: 'period', title: 'Elige el periodo', body: 'Cambia entre semana, quincena o mes. Al abrir la app se usa tu ciclo de cobro.' },
  { target: 'accounts', title: 'Tus cuentas y tu ahorro', body: 'Toca Tus cuentas para ver el saldo de cada tarjeta y de tu efectivo, pagar tu tarjeta o transferir. Caja de ahorro te lleva a tus metas.' },
  { target: 'add', fixed: true, title: 'Registra un movimiento', body: 'Toca + para anotar un gasto, ingreso o ahorro. Toca el monto para escribirlo, elige la cuenta y, si quieres, ponlo a meses sin intereses.' },
  { target: 'tab-moves', fixed: true, title: 'Movimientos', body: 'Tu historial del mes. Toca uno para editarlo, deslízalo para borrarlo y filtra por cuenta o categoría.' },
  { target: 'tab-history', fixed: true, title: 'Análisis', body: 'Descubre en qué gastas más, por categoría y comparado con el mes anterior.' },
  { target: 'tab-savings', fixed: true, title: 'Presupuestos y ahorro', body: 'Pon límites por categoría, crea metas y arma tu fondo de emergencia.' },
  { target: 'bell', fixed: true, title: 'Próximos pagos', body: 'Los pagos fijos y de tarjeta que vencen en los próximos 7 días.' },
  { target: 'profile', fixed: true, title: 'Tu perfil y ajustes', body: 'Recordatorios, notificaciones, exportar tus movimientos y volver a ver esta guía.' },
];

// Elementos que la guía puede iluminar: id -> ref de la vista
export const TourTargets = createContext(null);

export function useTourRef(id) {
  const targets = useContext(TourTargets);
  const ref = useRef(null);
  useEffect(() => {
    if (!targets) return undefined;
    targets.set(id, ref);
    return () => { if (targets.get(id) === ref) targets.delete(id); };
  }, [targets, id]);
  return ref;
}

export function TourTarget({ id, style, children }) {
  const ref = useTourRef(id);
  return <View ref={ref} collapsable={false} style={style}>{children}</View>;
}

const PAD = 6; // margen del reflector alrededor del elemento

// Quien la usa le pone un `key` distinto al abrirla para que empiece en el primer paso.
// scrollBy(dy): mueve la pantalla para que el elemento quede a la vista.
export function Tour({ visible, targets, onClose, scrollBy }) {
  const { width: W, height: H } = useWindowDimensions();
  // Solo los pasos cuyo elemento existe en esta pantalla (en computadora no hay campana, por ejemplo)
  const [steps] = useState(() => TOUR_STEPS.filter((st) => targets.has(st.target)));
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(undefined); // undefined: midiendo; null: no se encontró el elemento (tarjeta al centro)
  const step = steps[i];

  useEffect(() => {
    if (!visible || !step) return undefined;
    let alive = true;
    const measure = (then) => {
      const ref = targets.get(step.target);
      if (!ref || !ref.current || !ref.current.measureInWindow) { then(null); return; }
      ref.current.measureInWindow((x, y, w, h) => alive && then(w || h ? { x, y, w, h } : null));
    };
    const t = setTimeout(() => measure((r) => {
      // Si el elemento queda fuera de la vista (o detrás de la barra de abajo), se mueve la pantalla y se vuelve a medir
      if (r && !step.fixed && scrollBy && (r.y < 90 || r.y + r.h > H - 180)) {
        scrollBy(r.y - H * 0.25);
        setTimeout(() => measure(setRect), 150);
      } else setRect(r);
    }), 80);
    return () => { alive = false; clearTimeout(t); };
  }, [visible, i, step, targets, scrollBy, H]);

  if (!visible || !step) return null;
  const last = i === steps.length - 1;
  const go = (k) => { setRect(undefined); setI(k); };

  const cardW = Math.min(W - 24, 380);
  let cardPos = { top: H / 2 - 110 };
  let hole = null;
  if (rect) {
    hole = { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 };
    const below = rect.y + rect.h / 2 < H / 2;
    cardPos = below ? { top: hole.y + hole.h + 12 } : { bottom: H - hole.y + 12 };
  }
  const left = rect ? Math.min(Math.max(rect.x + rect.w / 2 - cardW / 2, 12), W - cardW - 12) : (W - cardW) / 2;
  const shade = 'rgba(0,0,0,0.62)';

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      {/* Bloquea los toques a la app mientras dura la guía */}
      <Pressable accessibilityRole="button" style={{ flex: 1 }} onPress={() => {}} accessible={false}>
        {hole ? (
          <>
            <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(hole.y, 0), backgroundColor: shade }} />
            <View style={{ position: 'absolute', left: 0, right: 0, top: hole.y + hole.h, bottom: 0, backgroundColor: shade }} />
            <View style={{ position: 'absolute', left: 0, width: Math.max(hole.x, 0), top: hole.y, height: hole.h, backgroundColor: shade }} />
            <View style={{ position: 'absolute', left: hole.x + hole.w, right: 0, top: hole.y, height: hole.h, backgroundColor: shade }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: 18, borderWidth: 2, borderColor: C.link }} />
          </>
        ) : <View style={{ flex: 1, backgroundColor: shade }} />}

        {rect !== undefined && <View style={[s.tourCard, { width: cardW, left }, cardPos]} accessibilityLiveRegion="polite">
          <Text style={s.tourStep}>Paso {i + 1} de {steps.length}</Text>
          <Text style={s.tourTitle}>{step.title}</Text>
          <Text style={s.tourBody}>{step.body}</Text>
          <View style={s.tourDots}>
            {steps.map((st, k) => <View key={st.target} style={[s.tourDot, k === i && s.tourDotOn]} />)}
          </View>
          <View style={s.tourRow}>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10}><Text style={s.tourGhost}>{last ? '' : 'Saltar guía'}</Text></Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              {i > 0 && <Pressable accessibilityRole="button" onPress={() => go(i - 1)} hitSlop={10}><Text style={s.tourGhost}>Atrás</Text></Pressable>}
              <Pressable accessibilityRole="button" onPress={() => (last ? onClose() : go(i + 1))} style={s.tourBtn}><Text style={s.tourBtnText}>{last ? 'Terminar' : 'Siguiente'}</Text></Pressable>
            </View>
          </View>
        </View>}
      </Pressable>
    </Modal>
  );
}
