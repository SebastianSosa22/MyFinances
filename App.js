import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Modal, Platform, StyleSheet, Keyboard, Animated, PanResponder, ActivityIndicator, AppState, RefreshControl } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

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

// ---------- Divisas y cuentas ----------
const CURS = { MXN: { sym: '$', flag: '🇲🇽' }, USD: { sym: 'US$', flag: '🇺🇸' }, EUR: { sym: '€', flag: '🇪🇺' }, GBP: { sym: '£', flag: '🇬🇧' }, CAD: { sym: 'CA$', flag: '🇨🇦' } };
const GROUPS = { divisas: { label: 'Divisas', icon: '💱' }, apartados: { label: 'Apartados', icon: '🎯' }, rendimientos: { label: 'Rendimientos', icon: '📈' } };
const FX_DEFAULT = { rates: { MXN: 1, USD: 18.0455 }, date: null }; // 1 USD = 18.0455 MXN, tipo de cambio de tu captura
const fmtCur = (n, c) => { const [i, f] = Math.abs(n).toFixed(2).split('.'); return (n < 0 ? '-' : '') + CURS[c].sym + commas(i) + '.' + f; };
const normAcc = (a) => ({ ...a, balance: Number(a.balance), annual_rate: a.annual_rate == null ? null : Number(a.annual_rate) });
// Pesos por cada unidad de divisa. Si no hay internet usa el último tipo de cambio guardado.
async function fetchRates() {
  try {
    const r = await fetch('https://api.frankfurter.dev/v1/latest?base=MXN&symbols=USD,EUR,GBP,CAD');
    const j = await r.json();
    const rates = { MXN: 1 };
    Object.entries(j.rates).forEach(([c, v]) => { rates[c] = 1 / v; });
    const out = { rates, date: j.date };
    AsyncStorage.setItem('fx', JSON.stringify(out));
    return out;
  } catch (e) {
    const raw = await AsyncStorage.getItem('fx');
    return raw ? JSON.parse(raw) : FX_DEFAULT;
  }
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
  const [accounts, setAccounts] = useState([]);
  const [fx, setFx] = useState(FX_DEFAULT);
  const [editAcc, setEditAcc] = useState(null);
  const [accModal, setAccModal] = useState(false);
  const rates = fx.rates;

  const load = async () => {
    const [m, a] = await Promise.all([
      supabase.from('movements').select('*').order('occurred_at', { ascending: false }),
      supabase.from('accounts').select('*').order('created_at', { ascending: true }),
    ]);
    const error = m.error || a.error;
    if (error) setErr('No se pudieron cargar los datos: ' + error.message);
    else { setMoves(m.data.map((x) => ({ ...x, amount: Number(x.amount) }))); setAccounts(a.data.map(normAcc)); setErr(''); }
    setFx(await fetchRates());
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => st === 'active' && load());
    return () => sub.remove();
  }, []);

  const addMove = async (row) => {
    const { data, error } = await supabase.from('movements').insert(row).select().single();
    if (error) { setErr('No se pudo guardar: ' + error.message); return false; }
    setMoves((prev) => [{ ...data, amount: Number(data.amount) }, ...prev]); setErr(''); return true;
  };
  const delMove = async (id) => {
    const prev = moves;
    setMoves(moves.filter((m) => m.id !== id));
    const { error } = await supabase.from('movements').delete().eq('id', id);
    if (error) { setMoves(prev); setErr('No se pudo borrar: ' + error.message); }
  };

  const saveAccount = async (row, id) => {
    const q = id ? supabase.from('accounts').update(row).eq('id', id) : supabase.from('accounts').insert(row);
    const { data, error } = await q.select().single();
    if (error) { setErr('No se pudo guardar la cuenta: ' + error.message); return false; }
    const acc = normAcc(data);
    setAccounts((prev) => (id ? prev.map((x) => (x.id === id ? acc : x)) : [...prev, acc])); setErr(''); return true;
  };
  const delAccount = async (id) => {
    const prev = accounts;
    setAccounts(accounts.filter((x) => x.id !== id));
    const { error } = await supabase.from('accounts').delete().eq('id', id);
    if (error) { setAccounts(prev); setErr('No se pudo borrar la cuenta: ' + error.message); }
  };

  // Resumen del periodo: del inicio (p. ej. día 1 del mes) hasta hoy, solo lo ya registrado
  const now = new Date(), start = periodStart(period);
  const income = moves.filter((m) => m.kind === 'income' && new Date(m.occurred_at) >= start && new Date(m.occurred_at) <= now).reduce((a, m) => a + m.amount, 0);
  const spent = { needs: 0, wants: 0, savings: 0 };
  moves.filter((m) => m.kind === 'expense').forEach((m) => { spent[bucketOf(m.cat)] += m.amount * occurrences(asExp(m), start, now); });
  const totalSpent = spent.needs + spent.wants + spent.savings;
  const fmt = (d) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        {!!err && <Text style={[s.hint, { color: '#FF3B30', marginBottom: 8 }]}>{err}</Text>}

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
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                <Donut size={140} label="Plan" center="50/30/20" values={Object.values(BUCKETS).map((b) => ({ value: b.pct, color: b.color }))} />
                <Donut size={140} label="Gasto real" center={income > 0 ? Math.round((totalSpent / income) * 100) + '%' : '0%'}
                  values={Object.keys(BUCKETS).map((k) => ({ value: spent[k], color: BUCKETS[k].color }))} />
              </View>
            </Card>
            <Title>Por categoría de la regla</Title>
            <Card>
              {Object.entries(BUCKETS).map(([k, b], i) => {
                const target = (income * b.pct) / 100;
                return (
                  <View key={k} style={[s.row, i > 0 && s.sep, { flexDirection: 'column', alignItems: 'stretch' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={s.body}><Text style={{ color: b.color }}>● </Text>{b.label} {b.pct}%</Text>
                      <Text style={[s.body, spent[k] > target && { color: '#FF3B30' }]}>{money(spent[k])} / {money(target)}</Text>
                    </View>
                    <Bar spent={spent[k]} budget={target} color={b.color} />
                  </View>
                );
              })}
            </Card>
            {income === 0 && <Text style={s.hint}>Toca + y registra un ingreso para calcular tu presupuesto.</Text>}
          </>
        )}

        {tab === 'moves' && (
          <>
            <Text style={s.largeTitle}>Movimientos</Text>
            <Card>
              {moves.length === 0 && <Text style={[s.hint, { padding: 16 }]}>Aún no hay movimientos. Toca + para agregar el primero.</Text>}
              {moves.map((m, i) => {
                const isInc = m.kind === 'income', c = CATS.find((x) => x.name === m.cat), b = BUCKETS[bucketOf(m.cat)];
                return (
                  <SwipeRow key={m.id} first={i === 0} onDelete={() => delMove(m.id)}>
                    <View style={s.row}>
                      <Text style={{ fontSize: 24, marginRight: 12 }}>{isInc ? '💵' : c ? c.icon : '🧾'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.body}>{isInc ? m.note || 'Ingreso' : m.cat}</Text>
                        <Text style={[s.caption, { color: isInc ? '#34C759' : b.color }]}>{isInc ? 'Ingreso' : b.label} · {freqLabel(asExp(m))}</Text>
                      </View>
                      <Text style={[s.body, { color: isInc ? '#34C759' : '#FF3B30' }]}>{isInc ? '+' : '-'}{money(m.amount, true)}</Text>
                    </View>
                  </SwipeRow>
                );
              })}
            </Card>
            {moves.length > 0 && <Text style={s.hint}>Desliza un movimiento hacia la izquierda para borrarlo.</Text>}
          </>
        )}

        {tab === 'accounts' && (() => {
          const toMXN = (a) => a.balance * (rates[a.currency] || 0);
          const total = accounts.reduce((x, a) => x + toMXN(a), 0);
          const saved = accounts.filter((a) => a.is_savings).reduce((x, a) => x + toMXN(a), 0);
          return (
            <>
              <Text style={s.largeTitle}>Cuentas</Text>
              <Card style={{ paddingBottom: 12 }}>
                <Text style={[s.caption, { marginTop: 12 }]}>Total en pesos</Text>
                <Text style={s.big}>{money(total, true)}</Text>
                <Text style={s.caption}>De ahorro: {money(saved, true)}</Text>
              </Card>
              {accounts.length === 0 && <Text style={s.hint}>Toca + para agregar tu primera cuenta.</Text>}
              {Object.entries(GROUPS).map(([g, info]) => {
                const list = accounts.filter((a) => a.grp === g);
                if (!list.length) return null;
                return (
                  <View key={g}>
                    <Title>{info.label}</Title>
                    <Card>
                      {list.map((a, i) => {
                        const sub = [a.is_savings && 'Ahorro', a.annual_rate != null && a.annual_rate.toFixed(2) + '% anual'].filter(Boolean).join(' · ');
                        return (
                          <SwipeRow key={a.id} first={i === 0} onDelete={() => delAccount(a.id)}>
                            <Pressable style={s.row} onPress={() => { setEditAcc(a); setAccModal(true); }}>
                              <Text style={{ fontSize: 28, marginRight: 12 }}>{g === 'divisas' ? CURS[a.currency].flag : info.icon}</Text>
                              <View style={{ flex: 1 }}>
                                <Text style={s.body}>{a.name}</Text>
                                {!!sub && <Text style={s.caption}>{sub}</Text>}
                              </View>
                              <View style={{ alignItems: 'flex-end' }}>
                                <Text style={s.body}>{fmtCur(a.balance, a.currency)}</Text>
                                {a.currency !== 'MXN' && <Text style={[s.caption, { paddingHorizontal: 0 }]}>{rates[a.currency] ? money(toMXN(a), true) : '—'}</Text>}
                              </View>
                            </Pressable>
                          </SwipeRow>
                        );
                      })}
                      {g === 'divisas' && (
                        <View style={[s.row, s.sep]}>
                          <Text style={{ fontSize: 28, marginRight: 12 }}>🪙</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={s.body}>Todas las divisas</Text>
                            <Text style={s.caption}>{new Set(list.map((a) => a.currency)).size} divisas</Text>
                          </View>
                          <Text style={s.body}>{money(list.reduce((x, a) => x + toMXN(a), 0), true)}</Text>
                        </View>
                      )}
                    </Card>
                  </View>
                );
              })}
              {!!rates.USD && <Text style={s.hint}>1 USD = {money(rates.USD, true)} MXN{fx.date ? ' · ' + fx.date : ''}</Text>}
              {accounts.length > 0 && <Text style={s.hint}>Toca una cuenta para editarla o desliza para borrarla.</Text>}
            </>
          );
        })()}

        {tab === 'settings' && (
          <>
            <Text style={s.largeTitle}>Ajustes</Text>
            <Title>Cuenta</Title>
            <Card style={{ padding: 16 }}>
              <Text style={s.body}>{session.user.email}</Text>
              <Pressable onPress={() => supabase.auth.signOut()}><Text style={[s.link, { color: '#FF3B30', marginTop: 12 }]}>Cerrar sesión</Text></Pressable>
            </Card>
          </>
        )}
      </ScrollView>

      {tab !== 'settings' && <Pressable style={s.fab} onPress={() => { if (tab === 'accounts') { setEditAcc(null); setAccModal(true); } else setModal(true); }}><Text style={s.fabText}>+</Text></Pressable>}
      <View style={s.tabbar}>
        {[['home', '📊', 'Resumen'], ['moves', '🧾', 'Movimientos'], ['accounts', '💼', 'Cuentas'], ['settings', '⚙️', 'Ajustes']].map(([k, ic, l]) => (
          <Pressable key={k} style={s.tab} onPress={() => setTab(k)}>
            <Text style={{ fontSize: 22, opacity: tab === k ? 1 : 0.45 }}>{ic}</Text>
            <Text style={[s.tabLabel, tab === k && { color: '#007AFF' }]}>{l}</Text>
          </Pressable>
        ))}
      </View>
      <AddMovement visible={modal} onClose={() => setModal(false)} onAdd={addMove} />
      <AccountSheet visible={accModal} account={editAcc} onClose={() => setAccModal(false)} onSave={saveAccount} />
    </View>
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
      : { kind, amount: n, cat, freq, day: freq === 'weekly' ? wday : freq === 'monthly' ? mday : null, occurred_at: new Date().toISOString() };
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
            {kind === 'income' ? (
              <TextInput style={s.input} placeholder="Concepto (ej. Nómina, Freelance)" value={note} onChangeText={setNote} />
            ) : (<>
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


function AccountSheet({ visible, account, onClose, onSave }) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(''), [bal, setBal] = useState(''), [cur, setCur] = useState('MXN');
  const [grp, setGrp] = useState('divisas'), [rate, setRate] = useState(''), [sav, setSav] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setName(account ? account.name : ''); setBal(account ? String(account.balance) : ''); setCur(account ? account.currency : 'MXN');
    setGrp(account ? account.grp : 'divisas'); setRate(account && account.annual_rate != null ? String(account.annual_rate) : ''); setSav(account ? account.is_savings : false);
  }, [visible, account]);
  const sym = CURS[cur].sym;
  const save = async () => {
    const n = parseFloat(bal), r = parseFloat(rate);
    if (!name.trim() || isNaN(n)) return;
    const row = { name: name.trim(), balance: n, currency: cur, grp, is_savings: sav, annual_rate: grp === 'rendimientos' && !isNaN(r) ? r : null };
    if (await onSave(row, account ? account.id : null)) { Keyboard.dismiss(); onClose(); }
  };
  const Chip = ({ on, color = '#007AFF', onPress, children }) => (
    <Pressable onPress={onPress} style={[s.chip, on && { backgroundColor: color }]}><Text style={[s.chipText, on && { color: '#fff' }]}>{children}</Text></Pressable>
  );
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.sheetWrap}>
        <View style={[s.sheet, { paddingTop: insets.top + 12 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Pressable onPress={onClose}><Text style={s.link}>Cancelar</Text></Pressable>
            <Text style={[s.body, { fontWeight: '600' }]}>{account ? 'Editar cuenta' : 'Nueva cuenta'}</Text>
            <Pressable onPress={save}><Text style={[s.link, { fontWeight: '600' }]}>Guardar</Text></Pressable>
          </View>
          <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <TextInput style={s.input} placeholder="Nombre (ej. Dólar estadounidense)" value={name} onChangeText={setName} />
            <TextInput style={s.amountInput} keyboardType="decimal-pad" placeholder={sym + '0.00'}
              value={bal === '' ? '' : sym + commas(bal.split('.')[0] || '0') + (bal.includes('.') ? '.' + bal.split('.')[1] : '')}
              onChangeText={(t) => setBal(cleanAmount(t))} />
            <Text style={[s.sectionTitle, { marginLeft: 4, marginTop: 0 }]}>Divisa</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {Object.keys(CURS).map((c) => <Chip key={c} on={cur === c} onPress={() => setCur(c)}>{CURS[c].flag} {c}</Chip>)}
            </View>
            <Text style={[s.sectionTitle, { marginLeft: 4, marginTop: 12 }]}>Tipo</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {Object.entries(GROUPS).map(([k, v]) => <Chip key={k} on={grp === k} onPress={() => setGrp(k)}>{v.icon} {v.label}</Chip>)}
            </View>
            {grp === 'rendimientos' && <TextInput style={s.input} keyboardType="decimal-pad" placeholder="Rendimiento anual en % (ej. 15)" value={rate} onChangeText={(t) => setRate(cleanAmount(t))} />}
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              <Chip on={sav} color="#34C759" onPress={() => setSav(!sav)}>{sav ? '✓ ' : ''}Cuenta como ahorro</Chip>
            </View>
          </ScrollView>
        </View>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
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