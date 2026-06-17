# Fase 1: Reconciliación pull (red de seguridad para el webhook)

Pragmatismo total. Cero adivinanzas de schemas, cero mapa del motorizado. El objetivo único es que el cliente vea los estados básicos (Recibido → En Cocina → En Camino → Entregado/Cancelado) aunque el webhook no dispare.

## 1. Cliente RP multi-tenant (`src/lib/restaurantpe.server.ts`)

Añadir, sin tocar lo existente:

- Helper `buildTenantBase()` que arma `https://${RESTAURANT_PE_SUBDOMINIO}.${RESTAURANT_PE_DOMINIO_HOST}/restaurant/api/rest` a partir de dos variables:
  - `RESTAURANT_PE_SUBDOMINIO` (ya existe, fallback `"kingpapa"`)
  - `RESTAURANT_PE_DOMINIO_HOST` (**nuevo secret**, valores aceptados: `restaurant.pe` | `quipupos.com` | `deliverygo.app`, fallback `"restaurant.pe"`)
- `rpFetchTenant<T>(path, init)` — fetch genérico contra esa base, header `Authorization: Token token="<RESTAURANT_PE_TOKEN>"`, timeout 6s, una reintento, **devuelve siempre `{ ok, status, raw, data }**` sin parsear envelope (firma defensiva). Nunca tira; loguea y devuelve `{ ok: false }`.
- `rpGetDeliveryById(id)` → `GET /delivery/get/{id}`
- `rpObtenerSyncFull(id)` → `GET /delivery/obtenerSyncFull/{id}` (fallback)
- Extractor `extractEstado(raw): { estado: string | null; motivo: string | null; eta_min: number | null }`. Recorre con `?.` posibles claves (`delivery_estado`, `data[0].delivery_estado`, `data.delivery_estado`, etc.) y devuelve null si no encuentra — nunca lanza.

Se mantiene el cliente actual (`HOST = http://api.restaurant.pe/...`) intacto para no romper checkout/menú/cancel. Reconcile es la única vía que usa la base por tenant.

## 2. Mapeo centralizado (`src/lib/restaurantpe-normalize.ts`)

Añadir `mapRpEstadoToLocal(estado: string | null): OrderStatus | null` que cubra los valores conocidos del Swagger (`DELIVERY_ACTIVO`, `DELIVERY_CONFIRMADO`, `DELIVERY_ENPREPARACION`, `DELIVERY_DESPACHADO`, `DELIVERY_ENCAMINO`, `DELIVERY_ENTREGADO`, `DELIVERY_ANULADO`) → `recibido | en_preparacion | en_camino | entregado | cancelado`. Estados desconocidos → `null` (no-op). Convive con el `mapWebhookStatusCode` actual sin tocarlo.

## 3. Server function `reconcileOrder` (`src/lib/orders.reconcile.functions.ts` nuevo)

```ts
reconcileOrder({ orderId: string }) → { changed, status, source: 'webhook' | 'reconcile' | 'noop' | 'error' }
```

Pasos dentro del `.handler()`:

1. `const { supabaseAdmin } = await import("@/integrations/supabase/client.server")`.
2. Lee `orders` por UUID. Si no existe o status terminal → `noop`.
3. **Rate-limit**: si `rp_response.last_reconcile_at` < 20s atrás → `noop` (lee `rp_response` actual, no llama RP).
4. Sin `rp_pedido_id` → `noop`.
5. Llama `rpGetDeliveryById(rp_pedido_id)`. Si `!ok` o sin estado, intenta `rpObtenerSyncFull`. Si ambos fallan → log `error`, return.
6. `extractEstado` + `mapRpEstadoToLocal`. Si estado nuevo == local → log `noop`, return (pero actualiza `last_reconcile_at`).
7. UPDATE en `orders`: `status`, `cancel_reason`/`cancelled_at` si cancelado, `rp_response = { ...prev, eta_min, last_reconcile_at, reconciled_status }`. Esto dispara Realtime → cliente refresca solo.
8. Inserta en `rp_sync_log` con `tipo='reconcile'`, payload `{ before, after, raw }`.

Server fn pública (sin `requireSupabaseAuth`): el caller envía solo el UUID interno (no enumerable, no PII) y la fn nunca expone datos sensibles en la respuesta.

## 4. Frontend reactivo (`src/components/kp/TrackerOperativo.tsx` y `src/routes/gracias.tsx`)

`TrackerOperativo.tsx`:

- Mantiene Realtime tal cual.
- Al montar y cada vez que el `orderId` cambia, dispara `reconcileOrder` una vez (cubre el gap entre checkout y primer webhook).
- Si `status ∈ {enviado, recibido, en_preparacion, en_camino}` y han pasado **>90s** desde el último cambio (`updated_at`), arranca backoff: 60s, 120s, 180s, 300s, 300s… se detiene si llega a terminal o si pasan 30 min sin cambios.
- Limpia el interval al desmontar y al pasar a terminal.

`gracias.tsx`:

- Si `status === 'enviado'` durante >5 min sin webhook ni reconcile exitoso, muestra:
  > "Estamos confirmando tu pedido con la cocina. Si tarda más de 10 min, te llamamos."
  - botón sutil **"Actualizar estado"** que invoca `reconcileOrder` manualmente y muestra toast con el resultado.

## 5. Panel `/admin/integraciones`

Añadir card **"Pedidos huérfanos"** debajo del estado RP:

- Cuenta órdenes con `status ∈ {enviado, recibido}` y `created_at < NOW() - interval '15 min'` que no tengan ningún registro en `rp_sync_log` con `tipo='webhook'` y `payload->>'order_id' = orders.id::text`.
- Lista los últimos 10 (UUID, `rp_pedido_id`, edad).
- Botón **"Reconciliar todos"** → server fn `reconcileOrphanOrders()` que itera la lista y llama `reconcileOrder` con un pequeño `await sleep(300ms)` entre cada uno (respeta rate-limit RP).

## 6. Secret nuevo

`RESTAURANT_PE_DOMINIO_HOST` — uno de `restaurant.pe | quipupos.com | deliverygo.app`. Antes de crear archivos pediré el valor con `add_secret`.

## Lo que NO se toca

- Webhook (`/api/public/rp-webhook`) — sigue siendo la fuente preferida cuando dispara.
- Tabla `orders`, RLS, migrations.
- Checkout, `orders.server.ts`, cliente RP existente (HOST `api.restaurant.pe`).
- Sin tracking de motorizado, sin mapa, sin `getTransportista`, sin `consultarUbicacionPedido` — Fase 2 abortada.

## Resultado esperado

- Cliente nunca queda atascado en "Pedido recibido" más de ~90s sin actualización.
- Admin ve y resuelve huérfanos en un clic.
- Tipado defensivo: si RP cambia el shape, no rompemos la app — solo dejamos de reconciliar y queda registrado en `rp_sync_log`.
- Cero llamadas extra por pedido cuando el webhook funciona (rate-limit + condición de >90s sin cambios).

¿Procedo?  
SI