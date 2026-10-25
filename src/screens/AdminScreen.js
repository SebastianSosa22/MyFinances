import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { Card, Segmented, Title } from '../components/ui';
import { CardHead, Columns, HBars, Pill, StatTile, TileGrid, TONE } from '../components/AdminCharts';
import { ACTION_LABELS, ADMIN_VIEWS, PERF_METRICS, PLATFORM_LABELS, RANGES, SCREEN_LABELS, SOURCE_LABELS } from '../constants/analytics';
import { CYCLES, EFREQ, SPLITS } from '../constants/budget';
import { useAdminDashboard } from '../hooks/useAdminDashboard';
import { useWide } from '../hooks/useWide';
import { ago, buildAdminInsights, pct, perfTone, secs, sortUsers } from '../lib/adminInsights';
import { commas } from '../lib/format';
import { C } from '../theme/colors';
import { s } from '../theme/styles';

const num = (n) => commas(String(n ?? 0));
const dayLabel = (iso) => { const [, m, d] = iso.split('-'); return Number(d) + '/' + Number(m); };
const entries = (obj, labels = {}) => Object.entries(obj || {}).map(([k, v]) => ({ label: (labels[k] && (labels[k].label || labels[k])) || k, value: Number(v) })).sort((a, b) => b.value - a.value);

// Panel de administrador: uso de la app, usuarios, funciones y rendimiento. Solo conteos, nunca montos.
export function AdminScreen({ me, onBack }) {
  const wide = useWide();
  const [view, setView] = useState('overview');
  const [days, setDays] = useState('30');
  const { data, loading, error, reload, setRole } = useAdminDashboard(Number(days));

  return (
    <>
      {!!onBack && <Pressable accessibilityRole="button" onPress={onBack} hitSlop={10} style={{ alignSelf: 'flex-start', paddingVertical: 6 }} accessibilityLabel="Regresar"><Text style={[s.linkSm, { fontSize: 15 }]}>‹ Regresar</Text></Pressable>}
      <Text style={s.screenTitle}>Panel de administrador</Text>
      <Segmented options={ADMIN_VIEWS} value={view} onChange={setView} style={{ marginTop: 12 }} />
      <View style={[s.tileRow, { alignItems: 'center', marginTop: 10, gap: 8 }]}>
        <Segmented options={RANGES} value={days} onChange={setDays} style={{ marginTop: 0, flex: 1, maxWidth: 300 }} />
        <Pressable accessibilityRole="button" onPress={reload} style={s.squareBtn} accessibilityLabel="Actualizar">{loading ? <ActivityIndicator color={C.muted} /> : <Text style={[s.panelTitle, { fontSize: 18 }]}>↻</Text>}</Pressable>
      </View>
      {!!data && <Text style={[s.caption, { paddingHorizontal: 4, marginTop: 8 }]}>Actualizado {ago(data.generated_at)} · Solo conteos de uso: no se muestran montos ni descripciones de nadie.</Text>}
      {!!error && <Text style={[s.hint, { color: C.red }]}>{error}</Text>}
      {!data && loading && <ActivityIndicator style={{ marginTop: 40 }} color={C.muted} />}
      {!!data && view === 'overview' && <Overview d={data} wide={wide} />}
      {!!data && view === 'users' && <Users d={data} me={me} onSetRole={setRole} />}
      {!!data && view === 'usage' && <Usage d={data} wide={wide} />}
      {!!data && view === 'perf' && <Perf d={data} wide={wide} />}
    </>
  );
}

function Overview({ d, wide }) {
  const k = d.kpis;
  const series = d.series || [];
  const insights = useMemo(() => buildAdminInsights(d), [d]);
  const users = d.users || [];
  const adoption = [
    { label: 'Completaron la bienvenida', value: pct(k.onboarded, k.users) },
    { label: 'Notificaciones activas', value: pct(k.push_users, k.users) },
    { label: 'Tienen al menos una meta', value: pct(users.filter((u) => u.goals > 0).length, k.users) },
    { label: 'Usan límites por categoría', value: pct(users.filter((u) => u.limits > 0).length, k.users) },
    { label: 'Registraron algo en el periodo', value: pct(users.filter((u) => u.movements_period > 0).length, k.users) },
  ];
  const kinds = d.by_kind || {};
  return (
    <>
      <TileGrid>
        <StatTile label="Usuarios" value={num(k.users)} sub={'+' + k.new_users + ' nuevos en ' + d.days + ' d'} />
        <StatTile label="Activos hoy" value={num(k.dau)} sub={pct(k.dau, k.users) + '% del total'} tone="good" />
        <StatTile label="Activos 7 días" value={num(k.wau)} sub={pct(k.wau, k.users) + '% del total'} />
        <StatTile label="Activos 30 días" value={num(k.mau)} sub={pct(k.mau, k.users) + '% del total'} />
        <StatTile label="Transacciones" value={num(k.movements_total)} sub={'Hoy: ' + k.movements_today} />
        <StatTile label={'Transacciones ' + d.days + ' d'} value={num(k.movements_period)} sub={k.mau ? (k.movements_period / Math.max(k.mau, 1)).toFixed(1) + ' por usuario activo' : ''} />
        <StatTile label="Sesiones" value={num(k.sessions_period)} sub={'en ' + d.days + ' días'} />
        <StatTile label="Inactivos +14 d" value={num(k.inactive_14d)} tone={k.inactive_14d ? 'warn' : 'good'} sub="sin abrir la app" />
      </TileGrid>

      <View style={wide ? s.cols : null}>
        <View style={wide ? s.col : null}>
          <Card>
            <CardHead title="Usuarios activos por día" sub="Abrieron la app, iniciaron sesión o registraron algo" />
            <Columns data={series.map((x) => ({ label: dayLabel(x.day), value: x.active }))} color={C.link} />
          </Card>
          <Card>
            <CardHead title="Transacciones registradas por día" sub="Todos los usuarios" />
            <Columns data={series.map((x) => ({ label: dayLabel(x.day), value: x.movements }))} color={C.blue} />
          </Card>
        </View>
        <View style={wide ? s.col : null}>
          <Card>
            <CardHead title="Gastos vs ingresos" sub={'Número de registros en ' + d.days + ' días'} />
            <HBars rows={[
              { label: 'Gastos', value: Number(kinds.expense || 0), color: C.red },
              { label: 'Ingresos', value: Number(kinds.income || 0), color: C.green },
            ]} />
          </Card>
          <Card>
            <CardHead title="Adopción de funciones" sub="% de usuarios que las usan" />
            <HBars rows={adoption} max={100} suffix="%" />
          </Card>
        </View>
      </View>

      <Title>Ideas de mejora</Title>
      <Card style={{ paddingBottom: 6 }}>
        {insights.map((x, i) => (
          <View key={i} style={[s.row, i > 0 && s.sep, { alignItems: 'flex-start' }]}>
            <View style={[s.toneDot, { backgroundColor: TONE[x.tone] }]} />
            <Text style={[s.body, { flex: 1, fontSize: 15 }]}>{x.text}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}

const SORTS = { recent: { label: 'Actividad' }, moves: { label: 'Transacciones' }, new: { label: 'Nuevos' } };

function Users({ d, me, onSetRole }) {
  const [sort, setSort] = useState('recent');
  const [q, setQ] = useState('');
  const [confirm, setConfirm] = useState(null); // id del usuario al que se le va a cambiar el rol
  const list = sortUsers(d.users, sort).filter((u) => !q || ((u.email || '') + ' ' + (u.full_name || '')).toLowerCase().includes(q.toLowerCase()));

  const changeRole = async (u) => {
    if (confirm !== u.id) { setConfirm(u.id); return; }
    setConfirm(null);
    await onSetRole(u.id, u.role === 'admin' ? 'user' : 'admin');
  };

  return (
    <>
      <Segmented options={SORTS} value={sort} onChange={setSort} />
      <TextInput style={s.input} placeholder="Buscar por nombre o correo" placeholderTextColor={C.muted} value={q} onChangeText={setQ} autoCapitalize="none" />
      <Text style={[s.caption, { paddingHorizontal: 4, marginTop: 8 }]}>{list.length} de {d.users.length} usuarios · cifras de los últimos {d.days} días salvo «total»</Text>
      {list.map((u) => (
        <Card key={u.id} style={{ padding: 16 }}>
          <View style={s.userHead}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.body, { fontWeight: '600' }]} numberOfLines={1}>{u.full_name || u.email}</Text>
              {!!u.full_name && <Text style={s.statSub} numberOfLines={1}>{u.email}</Text>}
            </View>
            <Pill text={u.role === 'admin' ? 'Admin' : 'Usuario'} tone={u.role === 'admin' ? 'warn' : 'info'} />
          </View>
          <Text style={[s.statSub, { marginTop: 6 }]}>
            Activo {ago(u.last_active)} · Cuenta creada {ago(u.created_at)}
          </Text>
          <View style={s.userStats}>
            <MiniStat label="Transacciones" value={u.movements} />
            <MiniStat label={'En ' + d.days + ' d'} value={u.movements_period} />
            <MiniStat label="Sesiones" value={u.sessions_period} />
            <MiniStat label="Metas" value={u.goals} />
            <MiniStat label="Límites" value={u.limits} />
          </View>
          <View style={s.chipsRow}>
            <Tag text={'Más usa: ' + (SCREEN_LABELS[u.top_screen] || '—')} />
            <Tag text={PLATFORM_LABELS[u.platform] || u.platform || 'Plataforma: —'} />
            {!!u.split && <Tag text={'Reparto ' + (SPLITS[u.split] ? SPLITS[u.split].label : u.split)} />}
            {!!u.cycle && <Tag text={'Cobra ' + (CYCLES[u.cycle] ? CYCLES[u.cycle].label.toLowerCase() : u.cycle)} />}
            <Tag text={u.push ? '🔔 Notificaciones' : '🔕 Sin notificaciones'} />
            {!u.onboarded && <Tag text="Sin bienvenida" />}
          </View>
          {u.id !== me && (
            <Pressable accessibilityRole="button" onPress={() => changeRole(u)} hitSlop={6}>
              <Text style={[s.link, { fontSize: 15, marginTop: 10 }, confirm === u.id && { color: C.orange }]}>
                {confirm === u.id ? 'Toca otra vez para confirmar' : u.role === 'admin' ? 'Quitar rol de administrador' : 'Hacer administrador'}
              </Text>
            </Pressable>
          )}
        </Card>
      ))}
    </>
  );
}

const MiniStat = ({ label, value }) => (
  <View style={s.miniStat}>
    <Text style={s.miniValue}>{num(value)}</Text>
    <Text style={s.statSub} numberOfLines={1}>{label}</Text>
  </View>
);

const Tag = ({ text }) => <View style={[s.chip, { paddingVertical: 5 }]}><Text style={[s.chipText, { fontSize: 13 }]}>{text}</Text></View>;

function Usage({ d, wide }) {
  const screens = (d.screens || []).map((x) => ({ label: SCREEN_LABELS[x.screen] || x.screen, value: Number(x.views), sub: x.users + ' usuarios' }));
  const actions = (d.actions || []).map((x) => ({ label: ACTION_LABELS[x.name] || x.name, value: Number(x.n), sub: x.users + ' usuarios' }));
  const cats = (d.top_categories || []).map((x) => ({ label: x.cat, value: Number(x.n), sub: x.users + ' usuarios' }));
  const platforms = (d.platforms || []).map((x) => ({ label: PLATFORM_LABELS[x.platform] || x.platform, value: Number(x.users), sub: x.sessions + ' sesiones' }));
  const hours = (d.hours || []).map((x) => ({ label: x.hour + 'h', value: Number(x.n) }));
  return (
    <View style={wide ? s.cols : null}>
      <View style={wide ? s.col : null}>
        <Card>
          <CardHead title="Pantallas más usadas" sub="Veces que se abrieron" />
          <HBars rows={screens} color={C.link} />
        </Card>
        <Card>
          <CardHead title="Acciones más usadas" sub="Qué hacen los usuarios dentro de la app" />
          <HBars rows={actions} color={C.blue} />
        </Card>
        <Card>
          <CardHead title="Horario de uso" sub="Actividad por hora del día (hora de CDMX)" />
          <Columns data={hours} color={C.orange} height={90} format={(v) => v + ' registros'} />
        </Card>
      </View>
      <View style={wide ? s.col : null}>
        <Card>
          <CardHead title="Categorías más registradas" sub="Número de transacciones (sin montos)" />
          <HBars rows={cats} color={C.primary} />
        </Card>
        <Card>
          <CardHead title="Dispositivos" sub="Usuarios por plataforma" />
          <HBars rows={platforms} color="#C9A7FF" />
        </Card>
        <Card>
          <CardHead title="Cómo registran" sub={d.with_note_pct + '% de las transacciones llevan descripción'} />
          <HBars rows={[...entries(d.by_freq, EFREQ), ...entries(d.by_source, SOURCE_LABELS).map((x) => ({ ...x, label: 'Origen: ' + x.label, color: C.blue }))]} />
        </Card>
        <Card>
          <CardHead title="Configuración elegida" sub="Reparto del presupuesto y ciclo de cobro" />
          <HBars rows={[...entries(d.splits, SPLITS), ...entries(d.cycles, CYCLES).map((x) => ({ ...x, color: C.orange }))]} />
        </Card>
      </View>
    </View>
  );
}

function Perf({ d, wide }) {
  const k = d.kpis;
  const perf = d.perf || [];
  const start = perf.find((p) => p.metric === 'app_start');
  return (
    <>
      <TileGrid>
        <StatTile label="Sesiones" value={num(k.sessions_period)} sub={'en ' + d.days + ' días'} />
        <StatTile label="Eventos registrados" value={num(k.events_period)} />
        <StatTile label="Errores" value={num(k.errors_period)} tone={k.errors_period ? 'bad' : 'good'} />
        <StatTile label="Arranque típico" value={start ? secs(start.p50) : '—'} tone={start ? perfTone('app_start', start.p50) : undefined} sub="mediana" />
      </TileGrid>
      <View style={wide ? s.cols : null}>
        <View style={wide ? s.col : null}>
          <Card>
            <CardHead title="Tiempos de respuesta" sub="Mediana y el 5% más lento (p95) en los dispositivos de los usuarios" />
            {perf.length === 0 && <Text style={[s.hint, { marginBottom: 16 }]}>Sin mediciones todavía</Text>}
            {perf.map((p, i) => {
              const tone = perfTone(p.metric, p.p95);
              return (
                <View key={p.metric} style={[s.row, i > 0 && s.sep]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.body}>{PERF_METRICS[p.metric] ? PERF_METRICS[p.metric].label : p.metric}</Text>
                    <Text style={s.statSub}>{num(p.n)} mediciones · promedio {secs(Number(p.avg_ms))}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.body, { fontWeight: '600' }]}>{secs(Number(p.p50))}</Text>
                    <Text style={[s.statSub, { color: TONE[tone] }]}>p95 {secs(Number(p.p95))}</Text>
                  </View>
                </View>
              );
            })}
          </Card>
          <Text style={[s.caption, { paddingHorizontal: 4 }]}>Verde: rápido · Amarillo: aceptable · Rojo: lento. Los umbrales están en constants/analytics.js.</Text>
        </View>
        <View style={wide ? s.col : null}>
          <Card>
            <CardHead title="Errores recientes" sub="Lo que falló en las apps de los usuarios" />
            {(d.errors || []).length === 0 && <Text style={[s.hint, { marginBottom: 16 }]}>Sin errores en el periodo 🎉</Text>}
            {(d.errors || []).map((e, i) => (
              <View key={i} style={[s.row, i > 0 && s.sep, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                <Text style={[s.body, { fontSize: 15 }]} numberOfLines={3}>{e.message || 'Error'}</Text>
                <Text style={s.statSub}>{ago(e.created_at)} · {e.email || '—'} · {SCREEN_LABELS[e.screen] || e.screen || '—'} · {PLATFORM_LABELS[e.platform] || e.platform || '—'}</Text>
              </View>
            ))}
          </Card>
        </View>
      </View>
    </>
  );
}
