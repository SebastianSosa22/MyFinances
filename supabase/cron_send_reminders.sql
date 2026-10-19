-- Ya aplicado en tu proyecto (respaldo). pg_net va en el esquema "extensions".
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Cada hora en punto; la función decide qué avisar según la hora local de cada dispositivo.
-- El secreto se lee de public.app_secrets (no queda escrito en este SQL).
select cron.schedule(
  'send-reminders-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://yphvecfopkaifhkndaru.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from public.app_secrets where key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
