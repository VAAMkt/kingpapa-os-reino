## Objetivo

Automatizar 100% la reconciliación con Restaurant.pe (cron cada 5 min), agregar Fase 3 (tracking en vivo con motorizado y GPS) y Fase 4 (validación de cobertura contra RP), y elevar la experiencia del cliente en la página de seguimiento.

---

## 1. Cron automático cada 5 min (sin intervención humana)

- Habilitar extensiones `pg_cron` y `pg_net` vía migración.
- Programar dos jobs:
  - `rp-reconcile-5min` → `POST` a `https://kingpapa.co/api/public/hooks/rp-reconcile` (poll + backlog Quipu) cada 5 min.
  - `rp-orphans-cleanup-hourly` → hook nuevo que dispara `reconcileOrder` para cada huérfano (auto-abandon TTL 45 min).
- Header `apikey: <SUPABASE_PUBLISHABLE_KEY>` (patrón canónico documentado).
- Registrar cada corrida en `rp_sync_log` (ya lo hace `checkQuipuBacklog` / `pollActiveOrders`).
- En `/admin/integraciones`: agregar card "Cron activo" mostrando última corrida (leyendo `rp_sync_log tipo IN ('poll_reconcile','quipu_backlog')`).

---

## 2. Fase 3 — Tracking en vivo (motorizado + GPS)

**Backend** (`src/lib/restaurantpe.server.ts`):

- `rpGetTransportistaByDelivery(deliveryId)` → `GET /delivery/getTransportistaByDelivery/{id}` para nombre + celular + placa del motorizado.
- `rpConsultarUbicacionPedido(deliveryId)` → `GET /delivery/consultarUbicacionPedido/{id}` para `{lat, lng, updated_at}`.

**Server function** (`src/lib/rp-tracking.functions.ts` nueva):

- `getLiveTracking({ orderId })`:
  - Lee `orders` (verifica que no sea terminal y tenga `rp_pedido_id`).
  - Llama en paralelo transportista + ubicación.
  - Persiste snapshot en `rp_response` (`live_motorizado`, `live_ubicacion`, `live_snapshot_at`) — mismo patrón `mergeRpResponse` del poll.
  - Devuelve `{ motorizado, ubicacion, sedeCoords }` (sede coords ya en `sedes.lat/lng`).
- Endpoint delgado, sin autenticación (el `orderId` UUID es no adivinable, mismo criterio que `/gracias`).

**UI** (`src/components/kp/TrackerOperativo.tsx`):

- Cuando `status === "en_camino"`:
  - Mostrar tarjeta con nombre del motorizado + botón "Llamar" (`tel:`) y "WhatsApp" (`wa.me`).
  - Mostrar mini-mapa (Google Maps embed estático o Leaflet con `<ClientOnly>`) con pin del motorizado y pin de la sede, actualizándose cada 20 s vía `useServerFn(getLiveTracking)`.
  - ETA calculada con haversine sede↔cliente en el server function (rough) hasta que RP exponga ETA real.
- Cuando `status === "en_preparacion"` o `"recibido"`: mostrar sólo comanda + tiempo estimado (evitar promesas de motorizado que aún no existen).
- Fallback si RP falla: skeleton silencioso, sin toast de error (no queremos que el cliente vea "algo salió mal" cuando el tracking secundario tiene un hipo).

---

## 3. Fase 4 — Validación de cobertura contra RP

- Añadir `rpValidarUbicacion({ localId, lat, lng })` → `POST /delivery/validarUbicacion` (o el path exacto detectado en Swagger).
- Usar como **check secundario** en el gate del checkout (`src/components/kp/LocationGate.tsx` / `pickNearestSede`):
  - Nuestra lógica interna sigue siendo la primaria (rápida, offline).
  - Después de elegir sede, disparar `rpValidarUbicacion` en background; si RP responde "fuera de zona" pero nosotros dijimos "en zona", loggear en `rp_sync_log tipo='coverage_mismatch'` (silencioso al usuario) para que admin lo revise.
  - No bloquea el pedido — sólo alerta discrepancias para tunear polígonos.

---

## 4. Mejoras UX en tracking

- **Barra de progreso con tiempos**: mostrar timestamps reales bajo cada paso ("Recibido 12:34", "En camino 12:41") leídos de `orders.updated_at` + `rp_response.poll_snapshot_at`.
- **Micro-copy dinámico** según status:
  - `recibido` → "Estamos alistando tu Reino 👑"
  - `en_preparacion` → "La cocina está en modo Rey"
  - `en_camino` → "Tu Reino sale a rodar 🛵" + tarjeta motorizado
  - `entregado` → CTA "Califica tu Reino" (link a WhatsApp)
- **Notificación push del navegador** (opt-in): cuando el status cambia a `en_camino`, disparar `new Notification()` si el usuario ya concedió permisos (pedirlos suavemente al mostrar el tracker por primera vez).
- **Botón "Compartir tracking"**: `navigator.share({ url: window.location.href })` para que el cliente reenvíe el link.

---

## Detalles técnicos

**Archivos nuevos:**
- `src/lib/rp-tracking.functions.ts` — server functions Fase 3.
- `src/routes/api/public/hooks/rp-orphans.ts` — hook cron para auto-abandon.
- Migración: habilitar `pg_cron` + `pg_net` + declarar los dos jobs.

**Archivos modificados:**
- `src/lib/restaurantpe.server.ts` — 3 helpers nuevos (transportista, ubicación, validarUbicacion).
- `src/components/kp/TrackerOperativo.tsx` — motorizado, mapa, tiempos, notificaciones, share.
- `src/components/kp/LocationGate.tsx` (o `pickNearestSede`) — hook Fase 4 en background.
- `src/routes/admin.integraciones.tsx` — card "Cron activo" + card "Discrepancias cobertura".

**No se toca:**
- `orders`, `webhooks` existentes, lógica de checkout, RLS, ni el flujo actual de creación de pedido. Todo lo nuevo es aditivo.

**Riesgos mitigados:**
- Si Swagger no expone realmente `getTransportistaByDelivery` o `consultarUbicacionPedido` en el tenant, el server function devuelve `null` y la UI simplemente no muestra el bloque motorizado — hago un `curl` de verificación con `RESTAURANT_PE_TENANT_TOKEN` **antes** de escribir la Fase 3, y ajusto endpoints si difieren.
- Cron sólo lee/actualiza status con `STATUS_RANK` (no regresa) — misma guardrail ya vigente.

---

## Orden de ejecución

1. Verificar endpoints Fase 3/4 con `curl` (tenant token).
2. Backend helpers + `rp-tracking.functions.ts`.
3. Migración `pg_cron` + jobs.
4. UI tracker (motorizado, mapa, tiempos, share, notificaciones).
5. Fase 4 en background + card admin.
6. Smoke test con Playwright en `/gracias?order_id=...` de un pedido activo.
