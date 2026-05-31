# Fase A — Sincronización pull desde Restaurant.pe

Endpoint confirmado vía DevTools del POS:
`GET http://{dominio}.restaurant.pe/restaurant/api/rest/pedido/getPedidoListByDelivery/{delivery_id}`

El `rp_pedido_id` que ya guardamos es el **delivery_id**. Este endpoint devuelve la lista de pedidos amarrados a ese delivery, de donde sacamos el número corto de comanda (`#158719`) y el estado real.

---

## 1. Fetcher en `src/lib/restaurantpe.server.ts`

Reemplazar `rpObtenerPedido` por `rpGetPedidoListByDelivery(deliveryId)`:

- Intento 1 (preferido, base API pública estándar):  
`GET {WRITE_BASE}/pedido/getPedidoListByDelivery/{deliveryId}`  
→ `http://api.restaurant.pe/restaurant/public/v2/rest/pedido/getPedidoListByDelivery/{id}`
- Fallback (si 404): ruta exacta del POS:  
`GET http://api.restaurant.pe/restaurant/api/rest/pedido/getPedidoListByDelivery/{id}`

Reglas:

- Timeout 10s, **sin reintentos** (one-shot por llamada).
- Header `Authorization: Token token="..."` con `RESTAURANT_PE_TOKEN`.
- Si ambos fallan → devolver `null` (no lanzar). Loguear una sola fila en `rp_sync_log` con `ok=false` y el status HTTP, **solo cuando falla** (no en cada éxito, para no inflar la tabla).
- Parser:
  - Esperamos `data` como array (o envelope `{tipo, data:[...]}`). Tomamos el primer pedido.
  - Extraer: `numero_comanda` / `numero` / `comanda` / `pedido_numero` (intentar en ese orden — los nombres exactos los confirmaremos al ver la primera respuesta real).
  - Extraer: `estado` / `estado_nombre` / `pedido_estado`.

## 2. Mapeo de estados RP → nuestro `status`

Crear helper `mapRpEstadoToStatus(rpEstado: string): OrderStatus | null` en `src/lib/restaurantpe-normalize.ts`:

```text
"pendiente" | "registrado" | "recibido"      → "recibido"
"en preparación" | "preparacion" | "cocina"  → "en_preparacion"
"en reparto" | "en camino" | "despachado"    → "en_camino"
"entregado" | "finalizado"                   → "entregado"
"anulado" | "cancelado" | "rechazado"        → "cancelado"
default                                       → null  (no tocar status local)
```

Comparación case-insensitive, sin acentos.

## 3. Server function `pollOrderFromRp`

Nuevo archivo `src/lib/orders.poll.functions.ts`:

```ts
export const pollOrderFromRp = createServerFn({ method: "POST" })
  .inputValidator((d: { orderId: string }) => d)
  .handler(async ({ data }) => { ... })
```

Lógica:

1. `supabaseAdmin.from("orders").select("id, status, rp_pedido_id, rp_numero_comanda").eq("id", data.orderId).maybeSingle()`.
2. Si no existe → `{ ok: false, reason: "not_found" }`.
3. Si `status ∈ {entregado, cancelado, error}` → `{ ok: true, terminal: true }` (no llama al POS).
4. Si no hay `rp_pedido_id` → `{ ok: true, skipped: "no_rp_id" }`.
5. Llamar `rpGetPedidoListByDelivery(rp_pedido_id)`.
6. Construir `updates` solo con campos que cambiaron:
  - `rp_numero_comanda` si lo recibimos y difiere.
  - `status` si el mapeo devuelve algo distinto al actual.
  - Si `status` pasa a `"cancelado"` y no había `cancel_reason` → `cancel_reason = "Cancelado desde el POS"`, `cancelled_at = now()`.
7. `UPDATE orders SET ... WHERE id = orderId` solo si hay cambios. Realtime propaga al cliente.
8. Devolver `{ ok: true, status, rp_numero_comanda }`.

Sin `requireSupabaseAuth`: el cliente que sigue su pedido en `/gracias` puede no estar autenticado. El input solo acepta `orderId`; la función no expone datos sensibles, solo dispara la sincronización y deja que Realtime + RLS de `orders` ("lectura por id reciente" 24h) entreguen los datos al cliente.

## 4. Polling en `src/components/kp/TrackerOperativo.tsx`

- Importar `pollOrderFromRp` vía `useServerFn`.
- Sustituir el `setInterval` actual (que solo re-lee la tabla) por uno que:
  - Cada **20s**, si `prevStatusRef.current ∉ {entregado, cancelado, error}` → llamar `pollOrderFromRp({ data: { orderId } })`.
  - No necesitamos refetch manual: el UPDATE de la fila viaja por la suscripción Realtime existente.
- Mantener el listener Realtime y el toast de cancelación que ya están en su sitio.
- Stop del interval en estados terminales y en `cleanup`.

## 5. Botón "Actualizar desde POS" en `src/routes/admin.pedidos.tsx`

Pequeño botón por fila (solo si `rp_pedido_id`) que llama `pollOrderFromRp` y muestra toast con el resultado. Útil para soporte.

## 6. Visibilidad del número corto

`TrackerOperativo` ya muestra `Comanda #{rp_numero_comanda}` cuando existe, con fallback al `rp_pedido_id`. Sin cambios de UI adicionales — en cuanto el primer poll resuelva, el badge se reemplaza por el número corto real.

---

## Archivos tocados

```text
src/lib/restaurantpe.server.ts            ← reemplaza rpObtenerPedido
src/lib/restaurantpe-normalize.ts         ← +mapRpEstadoToStatus
src/lib/orders.poll.functions.ts          ← NUEVO
src/components/kp/TrackerOperativo.tsx    ← polling 20s vía server fn
src/routes/admin.pedidos.tsx              ← botón "Actualizar desde POS"
```

Sin migraciones. Sin nuevos secrets. Sin nuevas rutas.

## Validación post-build

1. Hacer un pedido de prueba. Esperar 20s. Confirmar que el badge cambia de `ref: 159268` a `Comanda #158719`.
2. Desde el POS, cambiar el estado a "En reparto" → en ≤20s el tracker debe avanzar a "Motorizado en camino".
3. Desde el POS, anular el pedido → en ≤20s el tracker debe ponerse rojo con el toast y el mensaje genérico "Tu pedido fue cancelado desde el local".
4. Revisar `rp_sync_log` para confirmar que solo hay filas de error (no spam de éxitos).

## Lo que NO se hace

- ❌ No se añaden más candidatos especulativos. Solo los 2 explícitos (pública v2 + ruta del POS).
- ❌ No se loguea cada poll exitoso (evitar inflar `rp_sync_log`).
- ❌ No se cambia el intervalo a <20s.
- ❌ No se toca el flujo de creación de pedido ni `rpRegistrarDelivery`.

El plan estratégico está aprobado en un 95%. La lógica de polling cliente-servidor (Fase 3 y 4), el mapeo de estados (Fase 2) y evitar inflar los logs son decisiones de diseño excelentes.

Sin embargo, **tienes un error crítico en la URL de la Fase 1** que debemos corregir antes de escribir el código:

**Corrección en la Fase 1 (Fetcher):** En tu propuesta de "Fallback", pusiste `[http://api.restaurant.pe/restaurant/api](http://api.restaurant.pe/restaurant/api)...`. Esto fallará. El endpoint interno que descubrimos no usa `api.restaurant.pe`, usa el **subdominio específico del tenant** (en nuestro caso, `kingpapa`).

Sabiendo que el endpoint `getPedidoListByDelivery` es probablemente un endpoint interno no documentado en el Swagger V2 público, el orden y las URLs exactas deben ser:

- **Intento 1 (Ruta interna del POS - La más probable que funcione):** `GET http://{dominio}.restaurant.pe/restaurant/api/rest/pedido/getPedidoListByDelivery/{deliveryId}` *(Reemplazando* `{dominio}` *por nuestra variable de entorno, ej. kingpapa).*
- **Intento 2 (Fallback a la API Pública V2, por si acaso lo migraron):** `GET [https://api.restaurant.pe/restaurant/public/v2/rest/pedido/getPedidoListByDelivery/](https://api.restaurant.pe/restaurant/public/v2/rest/pedido/getPedidoListByDelivery/){dominio}/{deliveryId}`

**Instrucción final:** Ajusta las URLs en tu fetcher exactamente como te las acabo de indicar. Mantén intacto el resto del plan (Fases 2, 3, 4, 5 y 6, incluyendo los mapeos, el polling de 20s y los botones en admin).

Tienes luz verde absoluta. Escribe el código y avísame cuando esté desplegado para hacer la validación post-build.