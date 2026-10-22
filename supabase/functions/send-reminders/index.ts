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

function buildMessages(sub: any, moves: any[], cycle: string, payDay: number) {
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
        body: left >= 0 ? 'Ahorraste ' + money(left) + ': ya se sumaron a tu caja de ahorro.' : 'Gastaste ' + money(-left) + ' más de lo que ingresaste.',
      });
    }
  }
  return out;
}

Deno.serve(async (req) => {
  let config;
  try { config = await loadConfig(); } catch (e) { return new Response('config error: ' + (e instanceof Error ? e.message : String(e)), { status: 500 }); }
  if (!config.cron || req.headers.get('x-cron-secret') !== config.cron) return new Response('unauthorized', { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { data: subs, error } = await sb.from('push_subscriptions').select('*');
  if (error) return new Response(error.message, { status: 500 });

  const byUser = new Map<string, any[]>();
  (subs ?? []).forEach((s) => byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]));

  let sent = 0;
  for (const [userId, list] of byUser) {
    const [{ data: moves }, { data: st }] = await Promise.all([
      sb.from('movements').select('*').eq('user_id', userId),
      sb.from('user_settings').select('cycle,pay_day').eq('user_id', userId).maybeSingle(),
    ]);
    for (const sub of list) {
      const msgs = body.test ? [{ title: 'Finanzas', body: 'Notificación de prueba desde el servidor 🎉' }] : buildMessages(sub, moves ?? [], st?.cycle ?? 'weekly', st?.pay_day ?? 1);
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
