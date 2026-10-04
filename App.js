import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Modal, Platform, StyleSheet, Keyboard, Animated, PanResponder, ActivityIndicator, AppState, RefreshControl, Switch } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

// ---------- Configuración ----------
const BUCKETS = {
  needs: { label: 'Necesidades', pct: 50, color: '#007AFF' },
  wants: { label: 'Deseos', pct: 30, color: '#FF9500' },
  savings: { label: 'Ahorro', pct: 20, color: '#34C759' },
};
const CATS = [
  { name: 'Renta', icon: '🏠', bucket: 'needs' }, { name: 'Comida', icon: '🛒', bucket: 'needs' },
  { name: 'Transporte', icon: '🚌', bucket: 'needs' }, { name: 'Servicios', icon: '💡', bucket: 'needs' },
  { name: 'Salud', icon: '🩺', bucket: 'needs' },
  { name: 'Restaurantes', icon: '🍔', bucket: 'wants' }, { name: 'Ocio', icon: '🎬', bucket: 'wants' },
  { name: 'Compras', icon: '🛍️', bucket: 'wants' }, { name: 'Suscripciones', icon: '📺', bucket: 'wants' },
  { name: 'Ahorro', icon: '🐷', bucket: 'savings' }, { name: 'Inversión', icon: '📈', bucket: 'savings' },
  { name: 'Deudas', icon: '💳', bucket: 'savings' },
];
const FREQ = { weekly: { label: 'Semanal', perMonth: 52 / 12 }, biweekly: { label: 'Quincenal', perMonth: 2 }, monthly: { label: 'Mensual', perMonth: 1 } };
const PERIODS = { weekly: { label: 'Semana', div: 52 / 12 }, biweekly: { label: 'Quincena', div: 2 }, monthly: { label: 'Mes', div: 1 } };
const FONT = Platform.select({ ios: 'System', web: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif', default: 'System' });

const commas = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const money = (n, cents) => {
  const d = cents || !Number.isInteger(n) ? 2 : 0;
  const [i, f] = Math.abs(n).toFixed(d).split('.');
  return (n < 0 ? '-' : '') + '$' + commas(i) + (f ? '.' + f : '');
};
const cleanAmount = (t) => {
  const parts = t.replace(/[^0-9.]/g, '').split('.');
  const int = parts[0].replace(/^0+(?=\d)/, '');
  return parts.length > 1 ? int + '.' + parts.slice(1).join('').slice(0, 2) : int;
};
const showAmount = (raw) => (raw === '' ? '' : '$' + commas(raw.split('.')[0] || '0') + (raw.includes('.') ? '.' + raw.split('.')[1] : ''));
const EFREQ = { once: 'Una vez', weekly: 'Semanal', biweekly: 'Cada 2 sem.', monthly: 'Mensual', yearly: 'Anual' };
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
const nextDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

// Cuántas veces ocurre un gasto entre from y to (los recurrentes cuentan desde el día en que se crearon)
function occurrences(e, from, to) {
  const f = e.freq || 'once', st = midnight(new Date(e.date));
  if (f === 'once') { const d = new Date(e.date); return d >= from && d <= to ? 1 : 0; }
  let n = 0;
  for (let d = new Date(Math.max(from, st)); d <= to; d = nextDay(d)) {
    if (f === 'weekly' && d.getDay() === e.day) n++;
    else if (f === 'biweekly' && Math.round((d - st) / 864e5) % 14 === 0) n++;
    else if (f === 'monthly' && d.getDate() === Math.min(e.day, daysIn(d.getFullYear(), d.getMonth()))) n++;
    else if (f === 'yearly' && d.getMonth() === st.getMonth() && d.getDate() === st.getDate()) n++;
  }
  return n;
}
function freqLabel(e) {
  const f = e.freq || 'once';
  if (f === 'weekly') return 'Cada ' + DAYS[e.day];
  if (f === 'biweekly') return 'Cada 2 semanas';
  if (f === 'monthly') return 'Mensual · día ' + e.day;
  if (f === 'yearly') return 'Anual';
  return new Date(e.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}
const uid = () => Math.random().toString(36).slice(2, 9);

function periodStart(p, now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  if (p === 'weekly') return new Date(y, m, d - ((now.getDay() + 6) % 7));
  if (p === 'biweekly') return new Date(y, m, d <= 15 ? 1 : 16);
  return new Date(y, m, 1);
}

function periodEnd(p, start) {
  const y = start.getFullYear(), m = start.getMonth();
  if (p === 'weekly') return new Date(y, m, start.getDate() + 6);
  if (p === 'biweekly') return start.getDate() === 1 ? new Date(y, m, 15) : new Date(y, m + 1, 0);
  return new Date(y, m + 1, 0);
}

// ---------- Componentes ----------
const Card = ({ children, style }) => <View style={[s.card, style]}>{children}</View>;
const Title = ({ children }) => <Text style={s.sectionTitle}>{children}</Text>;

function Segmented({ options, value, onChange }) {
  return (
    <View style={s.seg}>
      {Object.entries(options).map(([k, v]) => (
        <Pressable key={k} onPress={() => onChange(k)} style={[s.segItem, value === k && s.segActive]}>
          <Text style={[s.segText, value === k && { fontWeight: '600' }]}>{v.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Donut({ values, size = 140, label, center }) {
  const r = size / 2 - 14, C = 2 * Math.PI * r, total = values.reduce((a, v) => a + v.value, 0);
  let acc = 0;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="#E5E5EA" strokeWidth={20} fill="none" />
          <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
            {total > 0 && values.map((v) => {
              const len = (v.value / total) * C;
              const el = <Circle key={v.color} cx={size / 2} cy={size / 2} r={r} stroke={v.color} strokeWidth={20} fill="none"
                strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />;
              acc += len; return el;
            })}
          </G>
        </Svg>
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={s.donutCenter}>{center}</Text>
        </View>
      </View>
      <Text style={s.caption}>{label}</Text>
    </View>
  );
}

function Bar({ spent, budget, color }) {
  const over = spent > budget, w = budget > 0 ? Math.min(spent / budget, 1) * 100 : 0;
  return (
    <View style={s.barBg}><View style={{ width: `${w}%`, height: 8, borderRadius: 4, backgroundColor: over ? '#FF3B30' : color }} /></View>
  );
}

// Dona única: cada tramo es una parte del plan 50/30/20 y se llena conforme gastas (rojo si te pasas)
function BudgetDonut({ spent, income, center, size = 200 }) {
  const sw = 24, r = size / 2 - sw / 2 - 2, C = 2 * Math.PI * r, gap = 6;
  let acc = 0;
  return (
    <View style={{ width: size, height: size, alignSelf: 'center', marginTop: 16 }}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          {Object.keys(BUCKETS).map((k) => {
            const seg = (BUCKETS[k].pct / 100) * C, len = seg - gap, start = acc;
            acc += seg;
            const target = (income * BUCKETS[k].pct) / 100;
            const fill = target > 0 ? Math.min(spent[k] / target, 1) * len : 0;
            const col = target > 0 && spent[k] > target ? '#FF3B30' : BUCKETS[k].color;
            const common = { cx: size / 2, cy: size / 2, r, strokeWidth: sw, fill: 'none', strokeDashoffset: -start };
            return (
              <G key={k}>
                <Circle {...common} stroke={BUCKETS[k].color} strokeOpacity={0.2} strokeDasharray={`${len} ${C - len}`} />
                {fill > 0 && <Circle {...common} stroke={col} strokeDasharray={`${fill} ${C - fill}`} />}
              </G>
            );
          })}
        </G>
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>{center}</View>
    </View>
  );
}

// ---------- Recordatorios (notificaciones locales en este teléfono) ----------
async function ensurePerm() {
  if (Platform.OS === 'web') return false;
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return !!req.granted;
}
async function syncReminders(moves, cfg) {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const nowD = new Date();
    let count = 0;
    if (cfg.on) {
      const rec = moves.filter((m) => m.kind === 'expense' && m.freq && m.freq !== 'once');
      for (let i = 0; i <= 21 && count < 50; i++) {
        const d = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate() + i);
        for (const m of rec) {
          if (occurrences(asExp(m), d, d) === 0) continue;
          const when = new Date(d.getFullYear(), d.getMonth(), d.getDate() - cfg.before, cfg.hour, 0, 0);
          if (when <= nowD) continue;
          await Notifications.scheduleNotificationAsync({
            content: {
              title: cfg.before ? 'Pago próximo' : 'Pago de hoy',
              body: (m.note || m.cat) + ' · ' + money(m.amount, true) + (cfg.before ? ' · ' + d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' }) : ''),
            },
            trigger: { type: 'date', date: when },
          });
          count++;
        }
      }
    }
    if (cfg.daily) await Notifications.scheduleNotificationAsync({ content: { title: 'Finanzas', body: '¿Ya registraste tus gastos de hoy?' }, trigger: { type: 'daily', hour: 21, minute: 0 } });
  } catch (e) { /* sin permiso o no disponible */ }
}

// Hoja que baja desde arriba (para que el teclado no tape el contenido)
function TopSheet({ visible, onClose, title, onSave, saveLabel = 'Guardar', children }) {
  const insets = useSafeAreaInsets();
  const [kb, setKb] = useState(false);
  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(show, () => setKb(true));
    const b = Keyboard.addListener(hide, () => setKb(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.sheetWrap}>
        <View style={[s.sheet, { paddingTop: insets.top + 12 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Pressable onPress={onClose}><Text style={s.link}>Cancelar</Text></Pressable>
            <Text numberOfLines={1} style={[s.body, { fontWeight: '600', flexShrink: 1, marginHorizontal: 8 }]}>{title}</Text>
            <Pressable onPress={onSave}><Text style={[s.link, { fontWeight: '600' }]}>{saveLabel}</Text></Pressable>
          </View>
          <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
        </View>
        <Pressable style={{ flex: 1 }} onPress={() => (kb ? Keyboard.dismiss() : onClose())} />
      </View>
    </Modal>
  );
}

// ---------- Fila con deslizar para borrar ----------
const DEL_W = 88;
function SwipeRow({ children, onDelete, first }) {
  const x = useRef(new Animated.Value(0)).current;
  const open = useRef(false);
  const snap = (end) => {
    open.current = end < -DEL_W / 2;
    Animated.spring(x, { toValue: open.current ? -DEL_W : 0, useNativeDriver: true, bounciness: 0 }).start();
  };
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => x.setValue(Math.max(-DEL_W, Math.min(0, (open.current ? -DEL_W : 0) + g.dx))),
    onPanResponderRelease: (_, g) => snap((open.current ? -DEL_W : 0) + g.dx),
    onPanResponderTerminate: (_, g) => snap((open.current ? -DEL_W : 0) + g.dx),
  })).current;
  return (
    <View style={!first && s.sep}>
      <View style={s.delBg}><Pressable style={s.delBtn} onPress={onDelete}><Text style={s.delText}>Borrar</Text></Pressable></View>
      <Animated.View style={{ transform: [{ translateX: x }], backgroundColor: '#fff' }} {...pan.panHandlers}>{children}</Animated.View>
    </View>
  );
}

// ---------- Inicio de sesión ----------
function Login() {
  const [email, setEmail] = useState(''), [pass, setPass] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const go = async (signUp) => {
    setBusy(true); setMsg('');
    const { data, error } = signUp ? await supabase.auth.signUp({ email, password: pass }) : await supabase.auth.signInWithPassword({ email, password: pass });
    setBusy(false);
    if (error) setMsg(error.message);
    else if (signUp && !data.session) setMsg('Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.');
  };
  return (
    <View style={[s.container, { padding: 16, justifyContent: 'center' }]}>
      <Text style={s.largeTitle}>Finanzas</Text>
      <Card style={{ padding: 16 }}>
        <TextInput style={s.input} placeholder="Correo" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={s.input} placeholder="Contraseña" secureTextEntry value={pass} onChangeText={setPass} />
        <Pressable style={s.button} onPress={() => go(false)} disabled={busy}><Text style={s.buttonText}>{busy ? 'Un momento…' : 'Iniciar sesión'}</Text></Pressable>
      </Card>
      <Pressable onPress={() => go(true)} disabled={busy}><Text style={[s.link, { textAlign: 'center', marginTop: 16 }]}>Crear cuenta</Text></Pressable>
      {!!msg && <Text style={[s.hint, { color: '#FF3B30' }]}>{msg}</Text>}
    </View>
  );
}

// ---------- App ----------
export default function App() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => data.subscription.unsubscribe();
  }, []);
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.root}>
        {session === undefined ? <ActivityIndicator style={{ marginTop: 80 }} /> : session ? <Main session={session} /> : <Login />}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const asExp = (m) => ({ freq: m.freq, day: m.day, date: m.occurred_at });
const bucketOf = (cat) => (CATS.find((c) => c.name === cat) || { bucket: 'wants' }).bucket;

function Main({ session }) {
  const [tab, setTab] = useState('home');
  const [period, setPeriod] = useState('monthly');
  const [moves, setMoves] = useState([]);
  const [modal, setModal] = useState(false);
  const [err, setErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [fType, setFType] = useState('all');
  const [fRange, setFRange] = useState('all');
  const [fBucket, setFBucket] = useState(null);
  const [fRec, setFRec] = useState(false);
  const [goals, setGoals] = useState([]);
  const [limits, setLimits] = useState({});
  const [rem, setRem] = useState({ on: false, daily: false, before: 1, hour: 9 });
  const [goalSheet, setGoalSheet] = useState({ open: false, goal: null });
  const [contrib, setContrib] = useState(null);
  const [notice, setNotice] = useState('');
  const load = async () => {
    const [m, g, l] = await Promise.all([
      supabase.from('movements').select('*').order('occurred_at', { ascending: false }),
      supabase.from('goals').select('*').order('created_at', { ascending: true }),
      supabase.from('category_limits').select('*'),
    ]);
    const error = m.error || g.error || l.error;
    if (error) setErr('No se pudieron cargar los datos: ' + error.message);
    else {
      setMoves(m.data.map((x) => ({ ...x, amount: Number(x.amount) })));
      setGoals(g.data.map((x) => ({ ...x, target: Number(x.target) })));
      const lim = {}; l.data.forEach((x) => { lim[x.cat] = Number(x.amount); }); setLimits(lim);
      setErr('');
    }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { AsyncStorage.getItem('reminders').then((raw) => { if (raw) setRem(JSON.parse(raw)); }); }, []);
  useEffect(() => { syncReminders(moves, rem); }, [moves, rem]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => st === 'active' && load());
    return () => sub.remove();
  }, []);

  const addMove = async (row) => {
    const { data, error } = await supabase.from('movements').insert(row).select().single();
    if (error) { setErr('No se pudo guardar: ' + error.message); return false; }
    setMoves((prev) => [{ ...data, amount: Number(data.amount) }, ...prev]); setErr('');
    const lim = limits[row.cat];
    if (row.kind === 'expense' && lim && (!row.freq || row.freq === 'once')) {
      const tot = (monthByCat[row.cat] || 0) + row.amount;
      setNotice(tot >= lim ? '⚠️ Superaste tu límite de ' + row.cat + ' (' + money(tot) + ' de ' + money(lim) + ').' : tot >= lim * 0.8 ? 'Vas en ' + Math.round((tot / lim) * 100) + '% de tu límite de ' + row.cat + '.' : '');
    } else setNotice('');
    return true;
  };
  const delMove = async (id) => {
    const prev = moves;
    setMoves(moves.filter((m) => m.id !== id));
    const { error } = await supabase.from('movements').delete().eq('id', id);
    if (error) { setMoves(prev); setErr('No se pudo borrar: ' + error.message); }
  };


  const saveGoal = async (row, id) => {
    const q = id ? supabase.from('goals').update(row).eq('id', id) : supabase.from('goals').insert(row);
    const { data, error } = await q.select().single();
    if (error) { setErr('No se pudo guardar la meta: ' + error.message); return false; }
    const g = { ...data, target: Number(data.target) };
    setGoals((prev) => (id ? prev.map((x) => (x.id === id ? g : x)) : [...prev, g])); setErr(''); return true;
  };
  const delGoal = async (id) => {
    const prev = goals;
    setGoals(goals.filter((x) => x.id !== id));
    setMoves(moves.map((m) => (m.goal_id === id ? { ...m, goal_id: null } : m)));
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (error) { setGoals(prev); load(); setErr('No se pudo borrar la meta: ' + error.message); }
  };
  const contribute = (g, amount) => addMove({ kind: 'expense', cat: 'Ahorro', amount, note: 'Aporte · ' + g.name, goal_id: g.id, occurred_at: new Date().toISOString() });
  const saveLimit = async (cat, value) => {
    if ((value || null) === (limits[cat] || null)) return;
    const { error } = value
      ? await supabase.from('category_limits').upsert({ user_id: session.user.id, cat, amount: value }, { onConflict: 'user_id,cat' })
      : await supabase.from('category_limits').delete().eq('cat', cat);
    if (error) { setErr('No se pudo guardar el límite: ' + error.message); return; }
    setLimits((p) => { const n = { ...p }; if (value) n[cat] = value; else delete n[cat]; return n; });
  };
  const setReminders = async (cfg) => {
    if ((cfg.on && !rem.on) || (cfg.daily && !rem.daily)) {
      if (!(await ensurePerm())) { setNotice('Activa las notificaciones de esta app en Ajustes del iPhone para recibir recordatorios.'); return; }
    }
    setRem(cfg); AsyncStorage.setItem('reminders', JSON.stringify(cfg));
  };

  // Resumen del periodo: del inicio (p. ej. día 1 del mes) hasta hoy, solo lo ya registrado
  const now = new Date(), start = periodStart(period);
  const income = moves.filter((m) => m.kind === 'income' && new Date(m.occurred_at) >= start && new Date(m.occurred_at) <= now).reduce((a, m) => a + m.amount, 0);
  const spent = { needs: 0, wants: 0, savings: 0 };
  moves.filter((m) => m.kind === 'expense').forEach((m) => { spent[bucketOf(m.cat)] += m.amount * occurrences(asExp(m), start, now); });
  const totalSpent = spent.needs + spent.wants + spent.savings;
  const fmt = (d) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

  // Límites del mes y meta sugerida de emergencia
  const monthRep = report(moves, new Date(now.getFullYear(), now.getMonth(), 1), now);
  const monthByCat = monthRep.byCat;
  const limitRows = Object.entries(limits).map(([cat, lim]) => [cat, lim, monthByCat[cat] || 0]).sort((x, y) => y[2] / y[1] - x[2] / x[1]);
  const needsAvg = (() => {
    const arr = [];
    for (let k = 1; k <= 3; k++) {
      const f = new Date(now.getFullYear(), now.getMonth() - k, 1);
      const v = report(moves, f, new Date(f.getFullYear(), f.getMonth() + 1, 0, 23, 59, 59, 999)).spent.needs;
      if (v > 0) arr.push(v);
    }
    return arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : monthRep.spent.needs;
  })();
  // Ritmo, próximos pagos, categorías y comparación
  const cur = report(moves, start, now);
  const end = periodEnd(period, start);
  const totalDays = Math.round((end - start) / 864e5) + 1;
  const elapsed = Math.round((midnight(now) - start) / 864e5) + 1;
  const daysLeft = Math.max(totalDays - elapsed + 1, 1);
  const avail = income - totalSpent;
  const timePct = Math.round((elapsed / totalDays) * 100);
  const spentPct = income > 0 ? Math.round((totalSpent / income) * 100) : 0;
  const upcoming = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    moves.filter((m) => m.kind === 'expense' && m.freq && m.freq !== 'once').forEach((m) => { if (occurrences(asExp(m), d, d) > 0) upcoming.push({ m, d }); });
  }
  const topCats = Object.entries(cur.byCat).sort((x, y) => y[1] - x[1]).slice(0, 3);
  const prev = period === 'monthly'
    ? report(moves, new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth() - 1, Math.min(now.getDate(), daysIn(now.getFullYear(), now.getMonth() - 1)), 23, 59, 59, 999))
    : null;

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        {!!err && <Text style={[s.hint, { color: '#FF3B30', marginBottom: 8 }]}>{err}</Text>}
        {!!notice && <Pressable onPress={() => setNotice('')}><Text style={[s.hint, { color: '#FF9500', marginBottom: 8 }]}>{notice}</Text></Pressable>}

        {tab === 'home' && (
          <>
            <Text style={s.largeTitle}>Resumen</Text>
            <Segmented options={PERIODS} value={period} onChange={setPeriod} />
            <Text style={[s.caption, { marginTop: 8 }]}>Del {fmt(start)} al {fmt(now)} (hoy)</Text>
            <Card style={{ marginTop: 12 }}>
              <Text style={[s.caption, { marginTop: 12 }]}>Disponible</Text>
              <Text style={[s.big, income - totalSpent < 0 && { color: '#FF3B30' }]}>{money(income - totalSpent)}</Text>
              <View style={[s.row, s.sep, { marginTop: 12 }]}>
                <View style={{ flex: 1 }}><Text style={s.caption}>Ingresos</Text><Text style={[s.body, { color: '#34C759', paddingHorizontal: 16 }]}>{money(income)}</Text></View>
                <View style={{ flex: 1 }}><Text style={s.caption}>Gastos</Text><Text style={[s.body, { color: '#FF3B30', paddingHorizontal: 16 }]}>{money(totalSpent)}</Text></View>
              </View>
            </Card>
            <Card>
              <BudgetDonut spent={spent} income={income} center={<><Text style={s.big2}>{spentPct}%</Text><Text style={s.caption}>de tus ingresos</Text></>} />
              <Text style={[s.caption, { textAlign: 'center', marginTop: 8 }]}>Cada tramo es una parte de tu plan 50/30/20 y se llena conforme gastas.</Text>
              {Object.entries(BUCKETS).map(([k, b]) => {
                const target = (income * b.pct) / 100;
                return (
                  <View key={k} style={[s.row, s.sep, { marginTop: 8, justifyContent: 'space-between' }]}>
                    <Text style={s.body}><Text style={{ color: b.color }}>● </Text>{b.label} {b.pct}%</Text>
                    <Text style={[s.body, spent[k] > target && { color: '#FF3B30' }]}>{money(spent[k])} / {money(target)}</Text>
                  </View>
                );
              })}
            </Card>
            {income === 0 && <Text style={s.hint}>Toca + y registra un ingreso para calcular tu presupuesto.</Text>}

            {income > 0 && (
              <>
                <Title>Ritmo del periodo</Title>
                <Card style={{ padding: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}><Text style={s.body}>Día {elapsed} de {totalDays}</Text><Text style={s.caption}>{timePct}%</Text></View>
                  <Bar spent={elapsed} budget={totalDays} color="#007AFF" />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, marginBottom: 6 }}><Text style={s.body}>Gastado de tus ingresos</Text><Text style={s.caption}>{spentPct}%</Text></View>
                  <Bar spent={totalSpent} budget={income} color={spentPct > timePct ? '#FF9500' : '#34C759'} />
                  <Text style={[s.hint, { textAlign: 'left', marginTop: 12, color: spentPct > timePct ? '#FF9500' : '#34C759' }]}>
                    {spentPct > timePct ? 'Vas gastando más rápido de lo que avanza el periodo.' : 'Vas bien: tu gasto va por debajo del ritmo del periodo.'}
                  </Text>
                  <View style={[s.row, s.sep, { paddingHorizontal: 0, marginTop: 8, justifyContent: 'space-between' }]}><Text style={s.body}>Puedes gastar por día</Text><Text style={[s.body, { fontWeight: '600' }]}>{money(Math.max(avail, 0) / daysLeft)}</Text></View>
                  <View style={[s.row, s.sep, { paddingHorizontal: 0, justifyContent: 'space-between' }]}><Text style={s.body}>Has gastado en promedio</Text><Text style={s.body}>{money(totalSpent / elapsed)} / día</Text></View>
                </Card>
              </>
            )}

            {limitRows.length > 0 && (
              <>
                <Title>Límites del mes</Title>
                <Card>
                  {limitRows.map(([cat, lim, sp], i) => {
                    const c = CATS.find((z) => z.name === cat), ratio = sp / lim;
                    const col = ratio >= 1 ? '#FF3B30' : ratio >= 0.8 ? '#FF9500' : '#34C759';
                    return (
                      <View key={cat} style={[s.row, i > 0 && s.sep, { flexDirection: 'column', alignItems: 'stretch' }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={s.body}>{c ? c.icon : '🧾'} {cat}</Text>
                          <Text style={[s.body, ratio >= 0.8 && { color: col }]}>{money(sp)} / {money(lim)}</Text>
                        </View>
                        <Bar spent={sp} budget={lim} color={col} />
                      </View>
                    );
                  })}
                </Card>
              </>
            )}

            {upcoming.length > 0 && (
              <>
                <Title>Próximos 7 días</Title>
                <Card>
                  {upcoming.map((u, i) => {
                    const c = CATS.find((z) => z.name === u.m.cat);
                    return (
                      <View key={u.m.id + i} style={[s.row, i > 0 && s.sep]}>
                        <Text style={{ fontSize: 22, marginRight: 12 }}>{c ? c.icon : '🧾'}</Text>
                        <View style={{ flex: 1 }}><Text style={s.body}>{u.m.note || u.m.cat}</Text><Text style={s.caption}>{u.d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}</Text></View>
                        <Text style={[s.body, { color: '#FF3B30' }]}>-{money(u.m.amount, true)}</Text>
                      </View>
                    );
                  })}
                  <View style={[s.row, s.sep, { justifyContent: 'space-between' }]}><Text style={s.body}>Total por pagar</Text><Text style={[s.body, { fontWeight: '600' }]}>{money(upcoming.reduce((a, u) => a + u.m.amount, 0), true)}</Text></View>
                </Card>
              </>
            )}

            {topCats.length > 0 && (
              <>
                <Title>En qué gastas más</Title>
                <Card>
                  {topCats.map(([name, amt], i) => {
                    const c = CATS.find((z) => z.name === name);
                    return (
                      <View key={name} style={[s.row, i > 0 && s.sep, { flexDirection: 'column', alignItems: 'stretch' }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}><Text style={s.body}>{c ? c.icon : '🧾'} {name}</Text><Text style={s.body}>{money(amt)} · {Math.round((amt / cur.total) * 100)}%</Text></View>
                        <Bar spent={amt} budget={topCats[0][1]} color={BUCKETS[bucketOf(name)].color} />
                      </View>
                    );
                  })}
                </Card>
              </>
            )}

            {prev && (prev.total > 0 || prev.income > 0) && (
              <>
                <Title>Vs. el mes pasado a esta fecha</Title>
                <Card>
                  <View style={s.row}>
                    <View style={{ flex: 1 }}><Text style={s.caption}>Ingresos</Text><Text style={[s.body, { paddingHorizontal: 16 }]}>{money(income)}</Text><Text style={s.caption}>antes {money(prev.income)}</Text><Delta now={income} prev={prev.income} upIsGood /></View>
                    <View style={{ flex: 1 }}><Text style={s.caption}>Gastos</Text><Text style={[s.body, { paddingHorizontal: 16 }]}>{money(totalSpent)}</Text><Text style={s.caption}>antes {money(prev.total)}</Text><Delta now={totalSpent} prev={prev.total} upIsGood={false} /></View>
                  </View>
                </Card>
              </>
            )}

            {moves.length > 0 && (
              <>
                <Title>Últimos movimientos</Title>
                <Card>
                  {moves.slice(0, 4).map((m, i) => {
                    const isInc = m.kind === 'income', c = CATS.find((z) => z.name === m.cat);
                    return (
                      <View key={m.id} style={[s.row, i > 0 && s.sep]}>
                        <Text style={{ fontSize: 22, marginRight: 12 }}>{isInc ? '💵' : c ? c.icon : '🧾'}</Text>
                        <View style={{ flex: 1 }}><Text style={s.body}>{isInc ? m.note || 'Ingreso' : m.note || m.cat}</Text><Text style={s.caption}>{freqLabel(asExp(m))}</Text></View>
                        <Text style={[s.body, { color: isInc ? '#34C759' : '#FF3B30' }]}>{isInc ? '+' : '-'}{money(m.amount, true)}</Text>
                      </View>
                    );
                  })}
                  <Pressable style={[s.row, s.sep, { justifyContent: 'center' }]} onPress={() => setTab('moves')}><Text style={s.link}>Ver todos</Text></Pressable>
                </Card>
              </>
            )}
          </>
        )}

        {tab === 'moves' && (() => {
          const isRec = (m) => m.kind === 'expense' && m.freq && m.freq !== 'once';
          const ql = q.trim().toLowerCase();
          const shown = moves.filter((m) => {
            if (fType !== 'all' && m.kind !== fType) return false;
            if (fBucket && (m.kind === 'income' || bucketOf(m.cat) !== fBucket)) return false;
            if (fRec && !isRec(m)) return false;
            const d = new Date(m.occurred_at);
            if (!isRec(m) && fRange === 'month' && d < periodStart('monthly')) return false;
            if (!isRec(m) && fRange === '30d' && d < new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)) return false;
            if (ql && !((m.cat || '').toLowerCase().includes(ql) || (m.note || '').toLowerCase().includes(ql))) return false;
            return true;
          });
          const inc = shown.filter((m) => m.kind === 'income').reduce((a, m) => a + m.amount, 0);
          const exp = shown.filter((m) => m.kind === 'expense').reduce((a, m) => a + m.amount, 0);
          const active = q || fType !== 'all' || fRange !== 'all' || fBucket || fRec;
          const clear = () => { setQ(''); setFType('all'); setFRange('all'); setFBucket(null); setFRec(false); };
          return (
            <>
              <Text style={s.largeTitle}>Movimientos</Text>
              <TextInput style={[s.input, { backgroundColor: '#E3E3E8', marginTop: 0 }]} placeholder="Buscar categoría o concepto" value={q} onChangeText={setQ} />
              <Segmented options={{ all: { label: 'Todos' }, expense: { label: 'Gastos' }, income: { label: 'Ingresos' } }} value={fType} onChange={setFType} />
              <Segmented options={{ all: { label: 'Todo' }, month: { label: 'Este mes' }, '30d': { label: '30 días' } }} value={fRange} onChange={setFRange} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                {Object.entries(BUCKETS).map(([k, x]) => (
                  <Pressable key={k} onPress={() => setFBucket(fBucket === k ? null : k)} style={[s.chip, { backgroundColor: fBucket === k ? x.color : '#fff' }]}>
                    <Text style={[s.chipText, fBucket === k && { color: '#fff' }]}>{x.label}</Text>
                  </Pressable>
                ))}
                <Pressable onPress={() => setFRec(!fRec)} style={[s.chip, { backgroundColor: fRec ? '#007AFF' : '#fff' }]}>
                  <Text style={[s.chipText, fRec && { color: '#fff' }]}>🔁 Recurrentes</Text>
                </Pressable>
              </View>
              {shown.length > 0 && (
                <Card style={{ marginTop: 8 }}>
                  <View style={s.row}>
                    <View style={{ flex: 1 }}><Text style={s.caption}>{shown.length} movimientos</Text><Text style={[s.body, { color: '#34C759', paddingHorizontal: 16 }]}>+{money(inc)}</Text></View>
                    <View style={{ flex: 1 }}><Text style={s.caption}>Total gastado</Text><Text style={[s.body, { color: '#FF3B30', paddingHorizontal: 16 }]}>-{money(exp)}</Text></View>
                  </View>
                </Card>
              )}
              <Card>
                {moves.length === 0 && <Text style={[s.hint, { padding: 16 }]}>Aún no hay movimientos. Toca + para agregar el primero.</Text>}
                {moves.length > 0 && shown.length === 0 && <Text style={[s.hint, { padding: 16 }]}>Ningún movimiento coincide con los filtros.</Text>}
                {shown.map((m, i) => {
                  const isInc = m.kind === 'income', c = CATS.find((x) => x.name === m.cat), b = BUCKETS[bucketOf(m.cat)];
                  return (
                    <SwipeRow key={m.id} first={i === 0} onDelete={() => delMove(m.id)}>
                      <View style={s.row}>
                        <Text style={{ fontSize: 24, marginRight: 12 }}>{isInc ? '💵' : c ? c.icon : '🧾'}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={s.body}>{isInc ? m.note || 'Ingreso' : m.note || m.cat}</Text>
                          <Text style={[s.caption, { color: isInc ? '#34C759' : b.color }]}>{isInc ? 'Ingreso' : (m.note ? m.cat + ' · ' : '') + b.label} · {freqLabel(asExp(m))}</Text>
                        </View>
                        <Text style={[s.body, { color: isInc ? '#34C759' : '#FF3B30' }]}>{isInc ? '+' : '-'}{money(m.amount, true)}</Text>
                      </View>
                    </SwipeRow>
                  );
                })}
              </Card>
              {active ? <Pressable onPress={clear}><Text style={[s.link, { textAlign: 'center', marginTop: 12 }]}>Quitar filtros</Text></Pressable>
                : moves.length > 0 && <Text style={s.hint}>Desliza un movimiento hacia la izquierda para borrarlo.</Text>}
            </>
          );
        })()}

        {tab === 'goals' && <Goals goals={goals} moves={moves} needsAvg={needsAvg}
          onEdit={(g) => setGoalSheet({ open: true, goal: g })} onDelete={delGoal} onContribute={setContrib}
          onEmergency={() => saveGoal({ name: 'Fondo de emergencia', target: Math.round(needsAvg * 3), deadline: null }, null)} />}

        {tab === 'history' && <History moves={moves} />}

        {tab === 'settings' && (
          <>
            <Text style={s.largeTitle}>Ajustes</Text>
            <Title>Recordatorios</Title>
            <Card>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <Text style={[s.body, { flex: 1, marginRight: 12 }]}>Avisarme de mis pagos recurrentes</Text>
                <Switch value={rem.on} onValueChange={(v) => setReminders({ ...rem, on: v })} />
              </View>
              {rem.on && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                  <Segmented options={{ 0: { label: 'Mismo día' }, 1: { label: '1 día antes' }, 3: { label: '3 días antes' } }} value={String(rem.before)} onChange={(k) => setReminders({ ...rem, before: Number(k) })} />
                  <Segmented options={{ 8: { label: '8:00' }, 9: { label: '9:00' }, 12: { label: '12:00' }, 18: { label: '18:00' } }} value={String(rem.hour)} onChange={(k) => setReminders({ ...rem, hour: Number(k) })} />
                </View>
              )}
              <View style={[s.row, s.sep, { justifyContent: 'space-between' }]}>
                <Text style={[s.body, { flex: 1, marginRight: 12 }]}>Recordarme registrar mis gastos (9 pm)</Text>
                <Switch value={rem.daily} onValueChange={(v) => setReminders({ ...rem, daily: v })} />
              </View>
            </Card>
            <Text style={s.hint}>Las notificaciones se programan en este teléfono y se actualizan cada vez que abres la app.</Text>

            <Title>Límites mensuales por categoría</Title>
            <Card>
              {CATS.filter((c) => c.bucket !== 'savings').map((c, i) => (
                <LimitRow key={c.name} first={i === 0} icon={c.icon} cat={c.name} value={limits[c.name]} spent={monthByCat[c.name] || 0} onSave={saveLimit} />
              ))}
            </Card>
            <Text style={s.hint}>Déjalo vacío si no quieres límite. Te avisamos en el Resumen y al registrar un gasto cuando llegues al 80% y al 100%.</Text>

            <Title>Cuenta</Title>
            <Card style={{ padding: 16 }}>
              <Text style={s.body}>{session.user.email}</Text>
              <Pressable onPress={() => supabase.auth.signOut()}><Text style={[s.link, { color: '#FF3B30', marginTop: 12 }]}>Cerrar sesión</Text></Pressable>
            </Card>
          </>
        )}
      </ScrollView>

      {tab !== 'settings' && tab !== 'history' && <Pressable style={s.fab} onPress={() => (tab === 'goals' ? setGoalSheet({ open: true, goal: null }) : setModal(true))}><Text style={s.fabText}>+</Text></Pressable>}
      <View style={s.tabbar}>
        {[['home', '📊', 'Resumen'], ['moves', '🧾', 'Movimientos'], ['goals', '🎯', 'Metas'], ['history', '🗓️', 'Historial'], ['settings', '⚙️', 'Ajustes']].map(([k, ic, l]) => (
          <Pressable key={k} style={s.tab} onPress={() => setTab(k)}>
            <Text style={{ fontSize: 22, opacity: tab === k ? 1 : 0.45 }}>{ic}</Text>
            <Text style={[s.tabLabel, tab === k && { color: '#007AFF' }]}>{l}</Text>
          </Pressable>
        ))}
      </View>
      <AddMovement visible={modal} onClose={() => setModal(false)} onAdd={addMove} />
      <GoalSheet visible={goalSheet.open} goal={goalSheet.goal} onClose={() => setGoalSheet({ open: false, goal: null })} onSave={saveGoal} />
      <ContributeSheet goal={contrib} onClose={() => setContrib(null)} onSubmit={contribute} />
    </View>
  );
}

// ---------- Metas ----------
const isoLocal = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function Goals({ goals, moves, needsAvg, onEdit, onDelete, onContribute, onEmergency }) {
  const now = new Date();
  const hasEmergency = goals.some((g) => /emergencia/i.test(g.name));
  return (
    <>
      <Text style={s.largeTitle}>Metas</Text>
      {goals.length === 0 && <Text style={s.hint}>Aún no tienes metas. Toca + para crear la primera.</Text>}
      {!hasEmergency && needsAvg > 0 && (
        <Card style={{ padding: 16 }}>
          <Text style={s.body}>🛟 Fondo de emergencia</Text>
          <Text style={[s.caption, { paddingHorizontal: 0, marginTop: 4 }]}>Meta sugerida: 3 meses de tus gastos en Necesidades, unos {money(needsAvg * 3)}.</Text>
          <Pressable style={s.button} onPress={onEmergency}><Text style={s.buttonText}>Crear esta meta</Text></Pressable>
        </Card>
      )}
      {goals.length > 0 && (
        <Card>
          {goals.map((g, i) => {
            const mine = moves.filter((m) => m.goal_id === g.id);
            const saved = mine.reduce((a, m) => a + m.amount, 0);
            const rem = Math.max(g.target - saved, 0), done = saved >= g.target;
            const firstT = mine.reduce((a, m) => Math.min(a, new Date(m.occurred_at).getTime()), now.getTime());
            const pace = saved / Math.max((now.getTime() - firstT) / (30.4 * 864e5), 1);
            const parts = [];
            if (done) parts.push('¡Meta lograda! 🎉');
            else {
              if (g.deadline) {
                const dl = new Date(g.deadline + 'T12:00:00');
                if (dl < now) parts.push('La fecha de esta meta ya pasó');
                else parts.push('Para el ' + dl.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ahorra ' + money(rem / Math.max(Math.ceil((dl - now) / (30.4 * 864e5)), 1)) + ' al mes');
              }
              if (pace > 0) parts.push('A tu ritmo la alcanzas en ' + monthName(new Date(now.getTime() + (rem / pace) * 30.4 * 864e5)));
            }
            return (
              <SwipeRow key={g.id} first={i === 0} onDelete={() => onDelete(g.id)}>
                <Pressable style={{ padding: 16 }} onPress={() => onEdit(g)}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={[s.body, { fontWeight: '600', flex: 1 }]}>{g.name}</Text>
                    <Text style={s.body}>{Math.min(Math.round((saved / g.target) * 100), 100)}%</Text>
                  </View>
                  <Bar spent={Math.min(saved, g.target)} budget={g.target} color="#34C759" />
                  <Text style={[s.caption, { paddingHorizontal: 0, marginTop: 6 }]}>{money(saved)} de {money(g.target)}{!done ? ' · faltan ' + money(rem) : ''}</Text>
                  {parts.length > 0 && <Text style={[s.caption, { paddingHorizontal: 0, marginTop: 2 }]}>{parts.join('\n')}</Text>}
                  {!done && <Pressable onPress={() => onContribute(g)} style={{ alignSelf: 'flex-start', marginTop: 10 }} hitSlop={8}><Text style={s.link}>+ Aportar</Text></Pressable>}
                </Pressable>
              </SwipeRow>
            );
          })}
        </Card>
      )}
      {goals.length > 0 && <Text style={s.hint}>Cada aporte cuenta como gasto de Ahorro. Toca una meta para editarla o desliza para borrarla.</Text>}
    </>
  );
}

function GoalSheet({ visible, goal, onClose, onSave }) {
  const [name, setName] = useState(''), [target, setTarget] = useState(''), [dl, setDl] = useState('none');
  useEffect(() => {
    if (visible) { setName(goal ? goal.name : ''); setTarget(goal ? String(goal.target) : ''); setDl(goal && goal.deadline ? 'keep' : 'none'); }
  }, [visible, goal]);
  const opts = { none: 'Sin fecha', 3: '3 meses', 6: '6 meses', 12: '1 año', 24: '2 años' };
  if (goal && goal.deadline) opts.keep = 'Actual (' + goal.deadline + ')';
  const save = async () => {
    const n = parseFloat(target);
    if (!name.trim() || !(n > 0)) return;
    let deadline = null;
    if (dl === 'keep') deadline = goal.deadline;
    else if (dl !== 'none') { const d = new Date(); d.setMonth(d.getMonth() + Number(dl)); deadline = isoLocal(d); }
    if (await onSave({ name: name.trim(), target: n, deadline }, goal ? goal.id : null)) onClose();
  };
  return (
    <TopSheet visible={visible} onClose={onClose} title={goal ? 'Editar meta' : 'Nueva meta'} onSave={save}>
      <TextInput style={[s.input, { marginBottom: 4 }]} placeholder="Nombre (ej. Viaje, Fondo de emergencia)" value={name} onChangeText={setName} maxLength={60} autoFocus={!goal} />
      <TextInput value={showAmount(target)} onChangeText={(x) => setTarget(cleanAmount(x))} keyboardType="decimal-pad" placeholder="$0.00" style={s.amountInput} />
      <Text style={[s.sectionTitle, { marginLeft: 4, marginTop: 0 }]}>Fecha objetivo</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {Object.entries(opts).map(([k, l]) => (
          <Pressable key={k} onPress={() => setDl(k)} style={[s.chip, dl === k && { backgroundColor: '#007AFF' }]}><Text style={[s.chipText, dl === k && { color: '#fff' }]}>{l}</Text></Pressable>
        ))}
      </View>
    </TopSheet>
  );
}

function ContributeSheet({ goal, onClose, onSubmit }) {
  const [amount, setAmount] = useState('');
  useEffect(() => { setAmount(''); }, [goal]);
  const save = async () => { const n = parseFloat(amount); if (n > 0 && (await onSubmit(goal, n))) { Keyboard.dismiss(); onClose(); } };
  return (
    <TopSheet visible={!!goal} onClose={onClose} title={goal ? 'Aportar a ' + goal.name : ''} onSave={save} saveLabel="Aportar">
      <TextInput value={showAmount(amount)} onChangeText={(x) => setAmount(cleanAmount(x))} keyboardType="decimal-pad" placeholder="$0.00" autoFocus style={s.amountInput} />
      <Text style={[s.caption, { paddingHorizontal: 4 }]}>El aporte cuenta como gasto de Ahorro (tu 20%).</Text>
    </TopSheet>
  );
}

function LimitRow({ cat, icon, value, spent, onSave, first }) {
  const [v, setV] = useState(value ? String(value) : '');
  useEffect(() => { setV(value ? String(value) : ''); }, [value]);
  return (
    <View style={[s.row, !first && s.sep]}>
      <Text style={{ fontSize: 22, marginRight: 12 }}>{icon}</Text>
      <View style={{ flex: 1 }}><Text style={s.body}>{cat}</Text><Text style={[s.caption, { paddingHorizontal: 0 }]}>Este mes: {money(spent)}</Text></View>
      <TextInput style={s.limitInput} keyboardType="decimal-pad" placeholder="Sin límite" value={showAmount(v)} onChangeText={(x) => setV(cleanAmount(x))} onEndEditing={() => onSave(cat, parseFloat(v) || null)} />
    </View>
  );
}

// ---------- Historial mensual ----------
const monthName = (d) => { const x = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }); return x.charAt(0).toUpperCase() + x.slice(1); };
function report(moves, from, to) {
  const spent = { needs: 0, wants: 0, savings: 0 }, byCat = {}, rows = [];
  let income = 0;
  moves.forEach((m) => {
    if (m.kind === 'income') {
      const d = new Date(m.occurred_at);
      if (d >= from && d <= to) { income += m.amount; rows.push({ m, amount: m.amount, label: 'Ingreso' }); }
      return;
    }
    const n = occurrences(asExp(m), from, to);
    if (n > 0) {
      const amt = m.amount * n;
      spent[bucketOf(m.cat)] += amt; byCat[m.cat] = (byCat[m.cat] || 0) + amt;
      rows.push({ m, amount: -amt, label: (n > 1 ? n + ' veces · ' : '') + freqLabel(asExp(m)) });
    }
  });
  return { income, spent, byCat, rows, total: spent.needs + spent.wants + spent.savings };
}
function Delta({ now, prev, upIsGood }) {
  if (!(prev > 0)) return null;
  const pc = Math.round(((now - prev) / prev) * 100);
  if (pc === 0) return <Text style={s.caption}>Igual que el mes anterior</Text>;
  const good = (pc > 0) === upIsGood;
  return <Text style={[s.caption, { color: good ? '#34C759' : '#FF3B30' }]}>{pc > 0 ? '▲' : '▼'} {Math.abs(pc)}% vs mes anterior</Text>;
}
function History({ moves }) {
  const [back, setBack] = useState(0);
  const now = new Date();
  const oldest = new Date(moves.reduce((a, m) => Math.min(a, new Date(m.occurred_at).getTime()), now.getTime()));
  const maxBack = (now.getFullYear() - oldest.getFullYear()) * 12 + now.getMonth() - oldest.getMonth();
  const b = Math.min(back, maxBack);
  const from = new Date(now.getFullYear(), now.getMonth() - b, 1);
  const to = b === 0 ? now : new Date(from.getFullYear(), from.getMonth() + 1, 0, 23, 59, 59, 999);
  const r = report(moves, from, to);
  const p = report(moves, new Date(from.getFullYear(), from.getMonth() - 1, 1), new Date(from.getFullYear(), from.getMonth(), 0, 23, 59, 59, 999));
  const balance = r.income - r.total;
  const cats = Object.entries(r.byCat).sort((x, y) => y[1] - x[1]);
  const rows = [...r.rows].sort((x, y) => new Date(y.m.occurred_at) - new Date(x.m.occurred_at));
  const days = b === 0 ? now.getDate() : daysIn(from.getFullYear(), from.getMonth());
  const spentPct = r.income > 0 ? Math.round((r.total / r.income) * 100) : 0;
  const savePct = r.income > 0 ? Math.round((r.spent.savings / r.income) * 100) : 0;
  const biggest = rows.filter((x) => x.amount < 0).sort((x, y) => x.amount - y.amount)[0];
  const Line = ({ label, value, color }) => (
    <View style={[s.row, s.sep, { paddingHorizontal: 0, justifyContent: 'space-between' }]}><Text style={s.body}>{label}</Text><Text style={[s.body, color && { color }]}>{value}</Text></View>
  );
  return (
    <>
      <Text style={s.largeTitle}>Historial</Text>
      <View style={[s.row, { justifyContent: 'space-between', paddingHorizontal: 4 }]}>
        <Pressable disabled={b >= maxBack} onPress={() => setBack(b + 1)} hitSlop={12}><Text style={[s.stepText, { fontSize: 28, opacity: b >= maxBack ? 0.25 : 1 }]}>‹</Text></Pressable>
        <Text style={[s.body, { fontWeight: '600' }]}>{monthName(from)}{b === 0 ? ' (en curso)' : ''}</Text>
        <Pressable disabled={b === 0} onPress={() => setBack(b - 1)} hitSlop={12}><Text style={[s.stepText, { fontSize: 28, opacity: b === 0 ? 0.25 : 1 }]}>›</Text></Pressable>
      </View>
      {r.rows.length === 0 ? <Text style={s.hint}>Sin movimientos en este mes.</Text> : (
        <>
          <Card>
            <Text style={[s.caption, { marginTop: 12 }]}>Balance del mes</Text>
            <Text style={[s.big, balance < 0 && { color: '#FF3B30' }]}>{money(balance)}</Text>
            <View style={[s.row, s.sep, { marginTop: 12 }]}>
              <View style={{ flex: 1 }}><Text style={s.caption}>Ingresos</Text><Text style={[s.body, { color: '#34C759', paddingHorizontal: 16 }]}>{money(r.income)}</Text></View>
              <View style={{ flex: 1 }}><Text style={s.caption}>Gastos</Text><Text style={[s.body, { color: '#FF3B30', paddingHorizontal: 16 }]}>{money(r.total)}</Text></View>
            </View>
          </Card>
          <Card>
            <BudgetDonut spent={r.spent} income={r.income} center={<><Text style={s.big2}>{spentPct}%</Text><Text style={s.caption}>de tus ingresos</Text></>} />
            {Object.entries(BUCKETS).map(([k, x]) => {
              const target = (r.income * x.pct) / 100;
              return (
                <View key={k} style={[s.row, s.sep, { marginTop: 8, justifyContent: 'space-between' }]}>
                  <Text style={s.body}><Text style={{ color: x.color }}>● </Text>{x.label} {x.pct}%</Text>
                  <Text style={[s.body, r.spent[k] > target && { color: '#FF3B30' }]}>{money(r.spent[k])} / {money(target)}</Text>
                </View>
              );
            })}
          </Card>
          <Title>Datos del mes</Title>
          <Card style={{ paddingHorizontal: 16 }}>
            <View style={[s.row, { paddingHorizontal: 0, justifyContent: 'space-between' }]}><Text style={s.body}>Gasto promedio por día</Text><Text style={s.body}>{money(r.total / days)}</Text></View>
            <Line label="Tasa de ahorro (meta 20%)" value={savePct + '%'} color={savePct >= 20 ? '#34C759' : '#FF9500'} />
            {biggest && <Line label={'Mayor gasto · ' + (biggest.m.note || biggest.m.cat)} value={money(-biggest.amount, true)} />}
            <Line label="Movimientos" value={String(rows.length)} />
          </Card>
          {cats.length > 0 && (
            <>
              <Title>Gasto por categoría</Title>
              <Card>
                {cats.map(([name, amt], i) => {
                  const c = CATS.find((z) => z.name === name);
                  return (
                    <View key={name} style={[s.row, i > 0 && s.sep, { flexDirection: 'column', alignItems: 'stretch' }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={s.body}>{c ? c.icon : '🧾'} {name}</Text>
                        <Text style={s.body}>{money(amt)} · {Math.round((amt / r.total) * 100)}%</Text>
                      </View>
                      <Bar spent={amt} budget={cats[0][1]} color={BUCKETS[bucketOf(name)].color} />
                    </View>
                  );
                })}
              </Card>
            </>
          )}
          {(p.total > 0 || p.income > 0) && (
            <>
              <Title>Vs. el mes anterior</Title>
              <Card>
                <View style={s.row}>
                  <View style={{ flex: 1 }}><Text style={s.caption}>Ingresos</Text><Text style={[s.body, { paddingHorizontal: 16 }]}>{money(r.income)}</Text><Text style={s.caption}>antes {money(p.income)}</Text><Delta now={r.income} prev={p.income} upIsGood /></View>
                  <View style={{ flex: 1 }}><Text style={s.caption}>Gastos</Text><Text style={[s.body, { paddingHorizontal: 16 }]}>{money(r.total)}</Text><Text style={s.caption}>antes {money(p.total)}</Text><Delta now={r.total} prev={p.total} upIsGood={false} /></View>
                </View>
              </Card>
            </>
          )}
          <Title>Movimientos del mes</Title>
          <Card>
            {rows.map((x, i) => (
              <View key={x.m.id} style={[s.row, i > 0 && s.sep]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.body}>{x.m.kind === 'income' ? x.m.note || 'Ingreso' : x.m.note || x.m.cat}</Text>
                  <Text style={s.caption}>{x.m.kind === 'expense' && x.m.note ? x.m.cat + ' · ' : ''}{x.label}</Text>
                </View>
                <Text style={[s.body, { color: x.amount > 0 ? '#34C759' : '#FF3B30' }]}>{x.amount > 0 ? '+' : '-'}{money(Math.abs(x.amount), true)}</Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </>
  );
}

function AddMovement({ visible, onClose, onAdd }) {
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState('Comida');
  const [freq, setFreq] = useState('once');
  const [wday, setWday] = useState(new Date().getDay());
  const [mday, setMday] = useState(new Date().getDate());
  const [kind, setKind] = useState('expense');
  const [note, setNote] = useState('');
  const [kb, setKb] = useState(false);
  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(show, () => setKb(true));
    const b = Keyboard.addListener(hide, () => setKb(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  const save = async () => {
    const n = parseFloat(amount);
    if (!(n > 0)) return;
    const row = kind === 'income'
      ? { kind, amount: n, note: note.trim() || 'Ingreso', occurred_at: new Date().toISOString() }
      : { kind, amount: n, cat, note: note.trim() || null, freq, day: freq === 'weekly' ? wday : freq === 'monthly' ? mday : null, occurred_at: new Date().toISOString() };
    if (await onAdd(row)) { setAmount(''); setNote(''); setFreq('once'); Keyboard.dismiss(); onClose(); }
  };
  // Toque en la zona gris: primero cierra el teclado; si ya está cerrado, cierra la hoja
  const tapOutside = () => (kb ? Keyboard.dismiss() : onClose());
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.sheetWrap}>
        <View style={[s.sheet, { paddingTop: insets.top + 12 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Pressable onPress={onClose}><Text style={s.link}>Cancelar</Text></Pressable>
            <Text style={[s.body, { fontWeight: '600' }]}>{kind === 'income' ? 'Nuevo ingreso' : 'Nuevo gasto'}</Text>
            <Pressable onPress={save}><Text style={[s.link, { fontWeight: '600' }]}>Guardar</Text></Pressable>
          </View>
          <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Segmented options={{ expense: { label: 'Gasto' }, income: { label: 'Ingreso' } }} value={kind} onChange={setKind} />
            <TextInput value={showAmount(amount)} onChangeText={(t) => setAmount(cleanAmount(t))} keyboardType="decimal-pad" placeholder="$0.00" autoFocus style={s.amountInput} />
            <TextInput style={[s.input, { marginTop: 0, marginBottom: 12 }]} placeholder={kind === 'income' ? 'Concepto (ej. Nómina, Freelance)' : 'Descripción (ej. Suscripción Spotify)'} value={note} onChangeText={setNote} maxLength={80} returnKeyType="done" />
            {kind === 'income' ? null : (<>
              <Text style={[s.sectionTitle, { marginLeft: 4, marginTop: 0 }]}>Categorías</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {CATS.map((c) => (
                  <Pressable key={c.name} onPress={() => setCat(c.name)}
                    style={[s.chip, cat === c.name && { backgroundColor: BUCKETS[c.bucket].color }]}>
                    <Text style={[s.chipText, cat === c.name && { color: '#fff' }]}>{c.icon} {c.name}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[s.caption, { paddingHorizontal: 4 }]}>Cuenta como: {BUCKETS[CATS.find((c) => c.name === cat).bucket].label}</Text>

              <Text style={[s.sectionTitle, { marginLeft: 4, marginTop: 16 }]}>Frecuencia</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {Object.entries(EFREQ).map(([k, l]) => (
                  <Pressable key={k} onPress={() => setFreq(k)} style={[s.chip, freq === k && { backgroundColor: '#007AFF' }]}>
                    <Text style={[s.chipText, freq === k && { color: '#fff' }]}>{l}</Text>
                  </Pressable>
                ))}
              </View>
              {freq === 'weekly' && (
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  {DAY_ORDER.map((d) => (
                    <Pressable key={d} onPress={() => setWday(d)} style={[s.dayChip, wday === d && { backgroundColor: '#007AFF' }]}>
                      <Text style={[s.chipText, { fontSize: 13 }, wday === d && { color: '#fff' }]}>{DAYS[d]}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {freq === 'monthly' && (
                <View style={s.stepper}>
                  <Text style={s.body}>Se cobra el día</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Pressable style={s.stepBtn} onPress={() => setMday(mday <= 1 ? 31 : mday - 1)}><Text style={s.stepText}>−</Text></Pressable>
                    <Text style={[s.body, { width: 36, textAlign: 'center', fontWeight: '600' }]}>{mday}</Text>
                    <Pressable style={s.stepBtn} onPress={() => setMday(mday >= 31 ? 1 : mday + 1)}><Text style={s.stepText}>+</Text></Pressable>
                  </View>
                </View>
              )}
              {freq !== 'once' && <Text style={[s.caption, { paddingHorizontal: 4, marginTop: 8 }]}>Se cuenta en tu presupuesto cada vez que toque, desde hoy.</Text>}
            </>)}
          </ScrollView>
        </View>
        <Pressable style={{ flex: 1 }} onPress={tapOutside} />
      </View>
    </Modal>
  );
}


// ---------- Estilos (iOS) ----------
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  container: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  largeTitle: { fontFamily: FONT, fontSize: 34, fontWeight: '700', color: '#000', marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontFamily: FONT, fontSize: 13, color: '#6C6C70', textTransform: 'uppercase', marginTop: 20, marginBottom: 6, marginLeft: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, marginTop: 12, overflow: 'hidden', padding: 0 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#C6C6C8' },
  body: { fontFamily: FONT, fontSize: 17, color: '#000' },
  caption: { fontFamily: FONT, fontSize: 13, color: '#6C6C70', paddingHorizontal: 16, marginTop: 4 },
  hint: { fontFamily: FONT, fontSize: 15, color: '#6C6C70', textAlign: 'center', marginTop: 16 },
  limitInput: { fontFamily: FONT, fontSize: 17, textAlign: 'right', width: 120, color: '#007AFF' },
  big2: { fontFamily: FONT, fontSize: 34, fontWeight: '700' },
  big: { fontFamily: FONT, fontSize: 40, fontWeight: '700', paddingHorizontal: 16, marginTop: 4 },
  donutCenter: { fontFamily: FONT, fontSize: 17, fontWeight: '600' },
  barBg: { height: 8, borderRadius: 4, backgroundColor: '#E5E5EA' },
  seg: { flexDirection: 'row', backgroundColor: '#E3E3E8', borderRadius: 9, padding: 2, marginTop: 12 },
  segItem: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 7 },
  segActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  segText: { fontFamily: FONT, fontSize: 13 },
  input: { fontFamily: FONT, fontSize: 17, backgroundColor: '#F2F2F7', borderRadius: 10, padding: 12, marginTop: 10 },
  button: { backgroundColor: '#007AFF', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 14 },
  buttonText: { fontFamily: FONT, color: '#fff', fontSize: 17, fontWeight: '600' },
  link: { fontFamily: FONT, color: '#007AFF', fontSize: 17 },
  fab: { position: 'absolute', right: 20, bottom: 84, width: 56, height: 56, borderRadius: 28, backgroundColor: '#007AFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  fabText: { color: '#fff', fontSize: 32, marginTop: -2 },
  tabbar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: 'rgba(249,249,249,0.96)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#C6C6C8', paddingBottom: 16, paddingTop: 6 },
  tab: { flex: 1, alignItems: 'center' },
  tabLabel: { fontFamily: FONT, fontSize: 10, color: '#8E8E93', marginTop: 2 },
  sheetWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { backgroundColor: '#fff', borderBottomLeftRadius: 20, borderBottomRightRadius: 20, padding: 20, paddingBottom: 16, maxHeight: '64%', width: '100%', maxWidth: 520, alignSelf: 'center' },
  amountInput: { fontFamily: FONT, fontSize: 40, fontWeight: '700', textAlign: 'center', marginVertical: 10 },
  dayChip: { flex: 1, backgroundColor: '#F2F2F7', borderRadius: 14, paddingVertical: 8, marginHorizontal: 2, alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 4 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: FONT, fontSize: 20, color: '#007AFF' },
  delBg: { position: 'absolute', right: 0, top: 0, bottom: 0, width: DEL_W, backgroundColor: '#FF3B30' },
  delBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  delText: { fontFamily: FONT, color: '#fff', fontSize: 17, fontWeight: '600' },
  chip: { backgroundColor: '#F2F2F7', borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12, margin: 4 },
  chipText: { fontFamily: FONT, fontSize: 15 },
});