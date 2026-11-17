// Envía al momento los avisos de gastos compartidos (te agregaron a un gasto, te marcaron un pago, aceptaron tu invitación).
// La base de datos los anota en public.shared_events y llama a esta función; aquí se mandan y se marcan como enviados.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

let cfg: { cron?: string } | null = null;
async function loadConfig() {
  if (cfg) return cfg;
  const { data } = await sb.from('app_secrets').select('key,value');
  const t: Record<string, string> = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? t.vapid_subject,
    Deno.env.get('VAPID_PUBLIC_KEY') ?? t.vapid_public_key,
    Deno.env.get('VAPID_PRIVATE_KEY') ?? t.vapid_private_key,
  );
  cfg = { cron: Deno.env.get('CRON_SECRET') ?? t.cron_secret };
  return cfg;
}

const PUSH_HOST = /^https:\/\/(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)\//;

function sameSecret(a: string | null, b: string) {
  const x = new TextEncoder().encode(a ?? ''), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < y.length; i++) diff |= (x[i] ?? 0) ^ y[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  let config;
  try { config = await loadConfig(); } catch (e) { console.error('config error', e); return new Response('config error', { status: 500 }); }
  if (!config.cron || !sameSecret(req.headers.get('x-cron-secret'), config.cron)) return new Response('unauthorized', { status: 401 });

  // Avisos pendientes de las últimas 48 h (los más viejos ya no sirven y se marcan como enviados sin mandarlos)
  const since = new Date(Date.now() - 48 * 3600e3).toISOString();
  const { data: events, error } = await sb.from('shared_events').select('*').is('sent_at', null).order('created_at').limit(100);
  if (error) { console.error(error); return new Response('db error', { status: 500 }); }
  if (!events?.length) return Response.json({ sent: 0 });

  // Se marcan primero para que dos llamadas seguidas no manden el mismo aviso dos veces
  const ids = events.map((e: any) => e.id);
  const { data: claimed } = await sb.from('shared_events').update({ sent_at: new Date().toISOString() }).in('id', ids).is('sent_at', null).select('*');
  const fresh = (claimed ?? []).filter((e: any) => e.created_at >= since);
  if (!fresh.length) return Response.json({ sent: 0 });

  const users = [...new Set(fresh.map((e: any) => e.user_id))];
  const { data: subs } = await sb.from('push_subscriptions').select('*').in('user_id', users);
  let sent = 0;
  for (const ev of fresh) {
    for (const sub of (subs ?? []).filter((s: any) => s.user_id === ev.user_id && PUSH_HOST.test(s.endpoint) && s.prefs?.shared !== false)) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ title: ev.title, body: ev.body, url: '/?compartidos=1' }));
        sent++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) await sb.from('push_subscriptions').delete().eq('id', sub.id);
      }
    }
  }
  return Response.json({ sent });
});
