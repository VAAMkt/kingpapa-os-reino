# Plan: Cierre integración Restaurant.pe (polling + UUID fix)

## Objetivo

Dejar el Tracker del cliente sincronizado automáticamente con el POS usando el endpoint público V2 confirmado por soporte, y eliminar el error 400 de Supabase Realtime causado por usar el `rp_pedido_id` numérico como si fuera el UUID de `orders.id`.

## Cambios

### 1. Fix UUID en Tracker y /gracias (bug Realtime + ZodError)

**Archivos:** `src/routes/gracias.tsx`, `src/components/kp/TrackerOperativo.tsx`

- El parámetro `order_id` puede llegar como:
  - UUID (flujo nuevo, ideal)
  - Número (`rp_pedido_id` / delivery_id que devuelve Restaurant.pe — caso actual)
- Crear server fn `resolveOrderId({ orderIdOrRef })` en `src/lib/orders.functions.ts`:
  - Si es UUID → devolverlo tal cual + datos básicos del pedido.
  - Si es numérico → buscar en `orders` por `rp_pedido_id = <num>` (texto) y devolver `id` (UUID).
  - Devolver `{ id, rp_pedido_id, rp_numero_comanda, status }`.
- `gracias.tsx` y `TrackerOperativo.tsx`:
  - Llamar `resolveOrderId` antes de cualquier query/subscripción.
  - Usar SIEMPRE el UUID resuelto para `supabase.channel(...).on('postgres_changes', { filter: 'id=eq.<uuid>' })` y para `from('orders').select().eq('id', uuid)`.
  - Quitar el Zod que exige UUID en la entrada cruda (validar después de resolver, no antes).

### 2. Fetcher público V2 en `restaurantpe.server.ts`

**Archivo:** `src/lib/restaurantpe.server.ts`

- Reemplazar/renombrar `rpGetPedidoListByDelivery` por `rpObtenerDelivery(deliveryId)` que pegue al endpoint público V2 (`/public/v2/rest/delivery/obtenerDelivery/{dominioId}/{deliveryId}` o el path exacto que documente Swagger — probaremos las 2-3 variantes documentadas y nos quedaremos con la que responda `tipo:"1"`).
- Header `Authorization: Token token="..."` con `RESTAURANT_PE_TOKEN` (mismo que ya usamos para `obtenerCartaPorLocal`).
- Devuelve `{ raw, delivery }` donde `delivery` es el objeto plano con las llaves confirmadas.
- Log a `rp_sync_log` si falla.

### 3. Mapeo determinístico en `restaurantpe-normalize.ts`

**Archivo:** `src/lib/restaurantpe-normalize.ts`

Reemplazar los extractors "adivinadores" por mapeo fijo según el esquema confirmado:

```ts
extractComandaNumber(delivery):
  return delivery.delivery_numero
      ?? `${delivery.venta?.venta_seriedoc}-${delivery.venta?.venta_numdoc}`
      ?? null
```

```ts
mapDeliveryEstado(n):
  0 | 1 -> "recibido"
  2     -> "en_preparacion"
  3     -> "en_camino"
  4     -> "cancelado"
  else  -> null
```

```ts
extractMotorizado(delivery): delivery.motorizado ?? null
```

Mantener `mapRpEstadoToStatus` (texto) como fallback por si algún endpoint sigue devolviendo string.

### 4. Server fn `pollOrderFromRp`

**Archivo:** `src/lib/orders.poll.functions.ts` (ya existe — reescribir)

Flujo:

1. Recibe `{ orderId }` (UUID ya resuelto).
2. Lee `orders` con `supabaseAdmin` → toma `rp_pedido_id` (delivery_id numérico).
3. Llama `rpObtenerDelivery(rp_pedido_id)`.
4. Extrae `delivery_numero`, `delivery_estado` (num), `motorizado`.
5. UPDATE `orders` SET:
  - `rp_numero_comanda = delivery_numero` (solo si cambia)
  - `status = mapDeliveryEstado(delivery_estado)` (solo si cambia y no es null)
  - `cancelled_at = now()` + `cancel_reason = 'Anulado en POS'` cuando pasa a `cancelado`.
6. Insert en `rp_sync_log` (ok/fail) con resumen.
7. Devuelve `{ status, rp_numero_comanda, motorizado, changed }`.

### 5. Reactivar polling en `TrackerOperativo`

**Archivo:** `src/components/kp/TrackerOperativo.tsx`

- `useEffect` con `setInterval(20_000)` que llama a `pollOrderFromRp({ orderId: uuid })`.
- Detenerlo cuando `status ∈ {entregado, cancelado}`.
- Mostrar `rp_numero_comanda` (corto, ej. `C10-12381`) en el título tan pronto exista; fallback a `rp_pedido_id` mientras no haya respuesta del POS.
- Mostrar nombre del motorizado cuando llegue.

### 6. Botón manual "Actualizar POS" en `/admin/pedidos`

**Archivo:** `src/routes/admin.pedidos.tsx`

- Botón por fila que llama `pollOrderFromRp` con el UUID y refresca la tabla (útil mientras validamos).

## Detalles técnicos

- **Auth endpoint público V2:** Token B2B server-side (`RESTAURANT_PE_TOKEN`), nunca cookie. Probaremos en orden:
  1. `http://api.restaurant.pe/restaurant/public/v2/rest/delivery/obtenerDelivery/{dominio}/{deliveryId}`
  2. `.../readonly/rest/delivery/obtenerDelivery/{dominio}/{deliveryId}`
  3. `.../public/v2/rest/delivery/obtenerEstadoDelivery/{dominio}/{deliveryId}`
  Nos quedamos con la primera que devuelva `tipo:"1"` y la dejamos hardcoded.
- **Idempotencia:** El UPDATE solo dispara si cambian `status` o `rp_numero_comanda` para no spamear Realtime ni el log.
- **RLS:** `pollOrderFromRp` corre server-side con `supabaseAdmin` (bypass RLS) — el cliente nunca toca `RESTAURANT_PE_TOKEN`.
- **Sin nuevas migraciones:** las columnas (`rp_numero_comanda`, `cancelled_at`, `cancel_reason`, `status`) ya existen en `orders`.

## Archivos tocados

- `src/lib/orders.functions.ts` (add `resolveOrderId`)
- `src/lib/orders.poll.functions.ts` (rewrite)
- `src/lib/restaurantpe.server.ts` (new `rpObtenerDelivery`, deprecate old)
- `src/lib/restaurantpe-normalize.ts` (new extractors + numeric estado map)
- `src/components/kp/TrackerOperativo.tsx` (resolver UUID + polling 20s)
- `src/routes/gracias.tsx` (resolver UUID antes de subscribirse)
- `src/routes/admin.pedidos.tsx` (botón "Actualizar POS")

## Validación

1. Abrir `/gracias?order_id=159276` → no debe aparecer ZodError; tracker carga.
2. A los ~20s el título debe cambiar de `#159276` a `real`.
3. Anular el pedido en el POS → en ≤20s el tracker se pone en rojo (cancelado).
4. `rp_sync_log` muestra una fila `poll_pedido ok` por cada tick exitoso.

**Tu Instrucción Estricta:**

**Fase 2 (Fetcher):** Implementa el fetcher apuntando únicamente a tu mejor suposición de la ruta oficial pública (ej. `GET http://api.restaurant.pe/restaurant/public/v2/rest/delivery/obtenerDelivery/{dominio}/{deliveryId}`). **Añade un manejo de error silencioso:** Si la API devuelve 404, 401 o cualquier error, la función debe devolver `null` y NO DEBE fallar ni romper la ejecución. Haz un log a `rp_sync_log` SOLO si falla la primera vez, no satures la base de datos en cada intento de polling si el endpoint sigue dando 404.

**Fase 4 y 5 (Polling y UI):** Implementa el `pollOrderFromRp` y el `setInterval` de 20s en `TrackerOperativo.tsx` exactamente como lo propusiste.

**Flujo Esperado (El MVP Real):**

1. El cliente entra a `/gracias`.
2. Se resuelve el UUID correctamente y Supabase Realtime se conecta sin error 400.
3. El tracker hace polling cada 20s. El fetcher intentará buscar el estado en Restaurant.pe.
4. Si el fetcher falla (porque el endpoint público resultó no ser ese), fallará silenciosamente, devolverá `null`, la base de datos no se actualizará, y **la UI dependerá al 100% de Supabase Realtime** cuando el administrador mueva los estados manualmente en `/admin/pedidos`.