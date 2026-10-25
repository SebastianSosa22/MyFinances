// Envía las notificaciones push (se ejecuta cada hora desde pg_cron).
// Cada dispositivo guarda su zona horaria y sus preferencias; aquí se decide qué avisar en la hora local de cada usuario.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// Configuración privada: primero variables de entorno (Edge Function secrets); si no existen, la tabla bloqueada app_secrets
let cfg: { cron?: string } | null = null;
async function loadConfig() {
  if (cfg) return cfg;
  const { data } = await sb.from('app_secrets').select('key,value');
  const t: Record<string, string> = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY') ?? t.vapid_public_key;
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY') ?? t.vapid_private_key;
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? t.vapid_subject;
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  cfg = { cron: Deno.env.get('CRON_SECRET') ?? t.cron_secret };
  return cfg;
}

// Solo se envía a servicios de notificaciones reales (la tabla también lo exige); evita que el servidor llame a URLs arbitrarias
const PUSH_HOST = /^https:\/\/(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)\//;

// Compara el secreto sin revelar por el tiempo de respuesta cuántos caracteres coinciden
function sameSecret(a: string | null, b: string) {
  const x = new TextEncoder().encode(a ?? ''), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < y.length; i++) diff |= (x[i] ?? 0) ^ y[i];
  return diff === 0;
}

const DAY = 864e5;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const money = (n: number) => '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const toU = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d); // día calendario como número
const fromU = (t: number) => { const x = new Date(t); return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate(), wd: x.getUTCDay() }; };
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

function localParts(date: Date, tz: string) {
  const p: Record<string, string> = {};
  new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', hour12: false, weekday: 'short' })
    .formatToParts(date).forEach((x) => { p[x.type] = x.value; });
  return { y: +p.year, m: +p.month, d: +p.day, hour: +p.hour % 24, wd: WEEKDAYS.indexOf(p.weekday) };
}
const localDay = (date: Date, tz: string) => { const p = localParts(date, tz); return toU(p.y, p.m, p.d); };

// ¿El movimiento (gasto o ingreso) cae en el día `t`? (misma lógica que la app, incluida la fecha de fin de los recurrentes)
function occursOn(m: any, t: number, tz: string) {
  const st = localDay(new Date(m.occurred_at), tz);
  if (t < st) return false;
  if (m.ends_at && m.freq && m.freq !== 'once') {
    const [ey, em, ed] = String(m.ends_at).slice(0, 10).split('-').map(Number);
    if (t > toU(ey, em, ed)) return false;
  }
  const x = fromU(t);
  switch (m.freq) {
    case 'weekly': return x.wd === m.day;
    case 'biweekly': return Math.round((t - st) / DAY) % 14 === 0;
    case 'monthly': return x.d === Math.min(m.day, daysIn(x.y, x.m));
    case 'yearly': { const s = fromU(st); return x.m === s.m && x.d === s.d; }
    default: return t === st;
  }
}

// Ciclo que acaba de cerrar, si hoy es el primer día del ciclo nuevo (el semanal empieza el día de cobro de cada usuario)
function justClosed(cycle: string, payDay: number, now: { y: number; m: number; d: number; wd: number }, today: number) {
  if (cycle === 'weekly' && now.wd === payDay) return { start: today - 7 * DAY, end: today - DAY, name: 'semana' };
  if (cycle === 'biweekly' && now.d === 1) return { start: toU(now.y, now.m - 1, 16), end: today - DAY, name: 'quincena' };
  if (cycle === 'biweekly' && now.d === 16) return { start: toU(now.y, now.m, 1), end: today - DAY, name: 'quincena' };
  if (cycle === 'monthly' && now.d === 1) return { start: toU(now.y, now.m - 1, 1), end: today - DAY, name: 'mes' };
  return null;
}

// Deuda de una tarjeta de crédito a hoy (misma regla que la app): lo que debías al registrarla + compras − pagos,
// contando desde el día en que se registró; las transferencias y los ajustes mueven la deuda sin ser gasto.
function cardDebt(a: any, moves: any[], transfers: any[], today: number, tz: string) {
  const from = localDay(new Date(a.created_at), tz);
  let debt = Number(a.opening_balance);
  moves.forEach((m) => {
    if (m.account_id !== a.id) return;
    for (let t = Math.max(from, localDay(new Date(m.occurred_at), tz)); t <= today; t += DAY) {
      if (occursOn(m, t, tz)) debt += (m.kind === 'income' ? -1 : 1) * Number(m.amount);
      if (!m.freq || m.freq === 'once') break;
    }
  });
  transfers.forEach((x) => {
    const d = localDay(new Date(x.occurred_at), tz);
    if (d < from || d > today) return;
    if (x.to_account_id === a.id) debt -= Number(x.amount);
    if (x.from_account_id === a.id) debt += Number(x.amount);
  });
  return Math.round(debt * 100) / 100;
}

// ¿El día `t` es el día `day` del mes? (si el mes es más corto, cuenta el último día)
const isMonthDay = (t: number, day: number) => { const x = fromU(t); return x.d === Math.min(day, daysIn(x.y, x.m)); };
const DUE_NOTICE_DAYS = 3;

function buildMessages(sub: any, moves: any[], cycle: string, payDay: number, accounts: any[] = [], transfers: any[] = []) {
  const tz = sub.tz, prefs = sub.prefs || {}, now = localParts(new Date(), tz), today = toU(now.y, now.m, now.d);
  const out: { title: string; body: string }[] = [];

  // 1) Pagos recurrentes que vencen en N días
  if (prefs.on && now.hour === (prefs.hour ?? 9)) {
    const before = prefs.before ?? 1;
    const due = moves.filter((m) => m.kind === 'expense' && m.freq && m.freq !== 'once' && occursOn(m, today + before * DAY, tz));
    if (due.length) {
      const names = due.slice(0, 3).map((m) => (m.note || m.cat) + ' ' + money(m.amount)).join(', ');
      out.push({
        title: before ? 'Pago próximo' : 'Pago de hoy',
        body: names + (due.length > 3 ? ' y ' + (due.length - 3) + ' más' : '') + ' · Total ' + money(due.reduce((a, m) => a + Number(m.amount), 0)),
      });
    }
  }

  // 1b) Tarjetas de crédito con deuda: el día del corte, 3 días antes del pago y el día del pago (a la hora elegida)
  if (prefs.cards !== false && now.hour === (prefs.hour ?? 9)) {
    accounts.filter((a) => a.type === 'credit' && !a.archived && (a.cut_day || a.due_day)).forEach((a) => {
      const debt = cardDebt(a, moves, transfers, today, tz);
      if (!(debt > 0)) return;
      if (a.cut_day && isMonthDay(today, a.cut_day)) out.push({ title: 'Hoy es el corte de ' + a.name, body: 'Tu deuda es de ' + money(debt) + '. Lo que compres desde mañana entra al siguiente estado de cuenta.' });
      if (a.due_day && isMonthDay(today, a.due_day)) out.push({ title: 'Hoy vence el pago de ' + a.name, body: 'Debes ' + money(debt) + '. Págala hoy para no pagar intereses.' });
      if (a.due_day && isMonthDay(today + DUE_NOTICE_DAYS * DAY, a.due_day)) out.push({ title: 'Paga tu tarjeta ' + a.name, body: 'El pago vence en ' + DUE_NOTICE_DAYS + ' días. Debes ' + money(debt) + '.' });
    });
  }

  // 2) Recordatorio diario a las 9 pm
  if (prefs.daily && now.hour === 21) out.push({ title: 'Finanzas', body: '¿Ya registraste tus gastos de hoy?' });

  // 3) Cierre del ciclo (9 am del primer día del ciclo nuevo)
  const closed = prefs.close !== false && now.hour === 9 ? justClosed(cycle, payDay, now, today) : null;
  if (closed) {
    let income = 0, spent = 0;
    moves.forEach((m) => {
      // Misma regla para ingresos (incluida la nómina recurrente) y gastos: se cuenta cada día en que ocurre
      for (let t = closed.start; t <= closed.end; t += DAY) if (occursOn(m, t, tz)) { if (m.kind === 'income') income += Number(m.amount); else spent += Number(m.amount); }
    });
    if (income > 0 || spent > 0) {
      const left = income - spent;
      out.push({
        title: 'Cerró tu ' + closed.name,
        body: left >= 0 ? 'Te sobraron ' + money(left) + '. Mándalos a Ahorro para que no se te vayan.' : 'Gastaste ' + money(-left) + ' más de lo que ingresaste.',
      });
    }
  }
  return out;
}

Deno.serve(async (req) => {
  let config;
  try { config = await loadConfig(); } catch (e) { console.error('config error', e); return new Response('config error', { status: 500 }); }
  if (!config.cron || !sameSecret(req.headers.get('x-cron-secret'), config.cron)) return new Response('unauthorized', { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { data: subs, error } = await sb.from('push_subscriptions').select('*');
  if (error) { console.error(error); return new Response('db error', { status: 500 }); }

  const byUser = new Map<string, any[]>();
  (subs ?? []).filter((s) => PUSH_HOST.test(s.endpoint)).forEach((s) => byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]));

  let sent = 0;
  for (const [userId, list] of byUser) {
    const [{ data: moves }, { data: st }, { data: accounts }, { data: transfers }] = await Promise.all([
      sb.from('movements').select('*').eq('user_id', userId),
      sb.from('user_settings').select('cycle,pay_day').eq('user_id', userId).maybeSingle(),
      sb.from('money_accounts').select('*').eq('user_id', userId),
      sb.from('account_transfers').select('*').eq('user_id', userId),
    ]);
    for (const sub of list) {
      const msgs = body.test ? [{ title: 'Finanzas', body: 'Notificación de prueba desde el servidor 🎉' }] : buildMessages(sub, moves ?? [], st?.cycle ?? 'weekly', st?.pay_day ?? 1, accounts ?? [], transfers ?? []);
      for (const msg of msgs) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ ...msg, url: '/' }));
          sent++;
        } catch (e) {
          // Dispositivo dado de baja: se elimina su suscripción
          if (e.statusCode === 404 || e.statusCode === 410) await sb.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }
  }
  return Response.json({ sent });
});
