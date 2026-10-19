# Notificaciones push (app web instalable)

## Estado
Ya está configurado en tu proyecto de Supabase (`finanzas-503020`):
- Tabla `push_subscriptions` (un dispositivo por fila, con RLS).
- Tabla bloqueada `app_secrets` con las claves VAPID y el secreto del cron (nadie con la clave pública de la app puede leerla).
- Función `send-reminders` publicada (versión 2) y programada **cada hora** con pg_cron.
- Probado: con el secreto correcto responde `{"sent":0}` (aún no hay dispositivos) y sin él responde 401.

En el código: `public/` (manifiesto, íconos, service worker), `src/lib/pushConfig.js` (clave pública) y la tarjeta
"Notificaciones push" de Ajustes con la guía para añadir a la pantalla de inicio.

## Lo único que falta: publicar la web e instalar en el iPhone
1. Haz commit y push (incluye `public/`); Render reconstruye con `npx expo export --platform web`.
2. En el iPhone: Safari > Compartir > Añadir a pantalla de inicio, abre la app desde el ícono, y en
   Ajustes toca "Activar notificaciones".
3. Toca "Enviar notificación de prueba" para confirmar.

## Qué avisa
- **Pagos recurrentes**: el mismo día, 1 o 3 días antes, a la hora que elijas en Recordatorios.
- **Registrar gastos**: todos los días a las 9 pm (si lo activas).
- **Cierre de ciclo**: a las 9 am del primer día del ciclo nuevo, cuánto ahorraste y se sumó a la caja.
Las horas son de la zona horaria de cada dispositivo.

## Mantenimiento
- Cambiar claves: genera otras con `npx web-push generate-vapid-keys`, actualiza `vapid_public_key` y
  `vapid_private_key` en `app_secrets` y pega la pública en `src/lib/pushConfig.js`. Los dispositivos tendrán que
  volver a activar las notificaciones.
- Alternativa más estándar: guardar los mismos valores como Edge Function Secrets (`VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`); la función los usa primero si existen.
- Prueba manual desde SQL Editor:
```
select net.http_post(
  url := 'https://yphvecfopkaifhkndaru.supabase.co/functions/v1/send-reminders',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from public.app_secrets where key='cron_secret')),
  body := '{"test":true}'::jsonb);
```
