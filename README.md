# Finanzas 50/30/20

App de finanzas personales (Expo + React Native + Supabase) basada en la regla 50/30/20.

## Estructura

```
App.js                      Punto de entrada de Expo (solo reexporta src/App)
app.json
public/                     Manifiesto, íconos y service worker (app web instalable y push)
scripts/make_icons.py       Dibuja el ícono de la caja fuerte y genera los tamaños en public/
supabase/                   Función send-reminders y SQL (push y cron)
src/
  App.js                    Sesión: muestra Login o la app
  AppShell.js               Estructura: barra lateral/inferior, pantalla activa, hojas
  constants/
    budget.js               BUCKETS (50/30/20), CATS (categorías), PERIODS, frecuencias, días
    navigation.js           TABS (pestañas de la app)
    security.js             Tiempos de cierre de sesión por inactividad
  theme/
    styles.js               Todos los estilos (StyleSheet `s`) y la tipografía
  lib/                      Lógica pura, sin interfaz
    supabase.js             Cliente de Supabase (URL y clave)
    format.js               Dinero, montos y fechas en texto
    auth.js                 Validación de correo/contraseña y mensajes de error de acceso
    dates.js                Inicio/fin de periodo, días del mes
    finance.js              Ocurrencias de gastos recurrentes, report() por rango de fechas
    summary.js              Cálculos del Resumen, próximos pagos, promedio de Necesidades
    savings.js              Caja de ahorro: cierres de cada ciclo y disponible del ciclo en curso
    reminders.js            Notificaciones locales de la app nativa (permisos y programación)
    push.js, pushConfig.js  Notificaciones push web (suscripción, clave VAPID pública)
    pwa.js                  Hace la web instalable y registra el service worker
  hooks/
    useFinanceData.js       Movimientos, metas y límites + operaciones con Supabase
    useIdleLogout.js        Cierre de sesión por inactividad (aviso 60 s antes)
    useReminders.js         Preferencias de recordatorios
    usePush.js              Estado y acciones de las notificaciones push web
    useUserSettings.js      Ciclo de ingreso y % a apartar (Supabase + copia local)
    useWide.js              Detecta escritorio (>= 900 px)
  components/               Piezas reutilizables
    ui.js                   Card, Title, Segmented, Bar
    DismissKeyboard.js, IdleWarning.js, PushCard.js, SavingsCard.js, Donut.js, BudgetDonut.js, Delta.js, SwipeRow.js, TopSheet.js, Sidebar.js, TabBar.js
  screens/                  Una pantalla por pestaña
    HomeScreen.js (Resumen), SavingsScreen.js (Caja), MovesScreen.js, GoalsScreen.js, HistoryScreen.js,
    SettingsScreen.js, LoginScreen.js
  sheets/                   Hojas que bajan desde arriba
    AddMovementSheet.js, GoalSheet.js, ContributeSheet.js
```

## Dónde tocar según lo que quieras cambiar

| Quiero... | Archivo |
|---|---|
| Agregar o cambiar categorías | `src/constants/budget.js` (`CATS`) |
| Cambiar los porcentajes 50/30/20 | `src/constants/budget.js` (`BUCKETS`) |
| Cambiar colores, tamaños, estilos | `src/theme/styles.js` |
| Agregar una pestaña nueva | `constants/navigation.js` (TABS) + nueva pantalla en `screens/` + una línea en `AppShell.js` |
| Anunciar novedades a los usuarios (una vez) | `src/constants/release.js` (cambia `id` y `cutoff`) |
| Cambiar un cálculo del Resumen | `src/lib/summary.js` |
| Cambiar cómo funciona la caja de ahorro | `src/lib/savings.js` |
| Agregar una operación con datos | `src/hooks/useFinanceData.js` |
| Cambiar la URL o clave de Supabase | `src/lib/supabase.js` |

## Reglas para mantenerlo limpio

- Las **pantallas** solo reciben datos por props y no hablan con Supabase; eso vive en `hooks/`.
- La **lógica de cálculo** va en `lib/`, no dentro de los componentes.
- Cada archivo exporta con nombre (`export function ...`); solo `src/App.js` usa `export default`.
- Los estilos viven en `theme/styles.js`, no se repiten colores ni medidas sueltas.

## Base de datos

Las tablas viven en Supabase. `schema_user_settings.sql` crea la de ajustes de la caja de ahorro (ejecútalo en el SQL Editor).

## Notificaciones push

Ver `PUSH_SETUP.md` (claves VAPID, secretos de Supabase y programación).

## Comandos

```
npx expo start                      # desarrollo
npx expo export --platform web      # genera dist/ para Render
```

Render (Static Site): Build Command `npx expo export --platform web`, Publish Directory `dist`,
y una regla Rewrite de `/*` a `/index.html`.
