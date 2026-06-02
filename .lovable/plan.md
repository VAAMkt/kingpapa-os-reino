
## Plan definitivo v2 — alineado al Swagger oficial 2-oas3

Sin webhooks (el panel del cliente no los expone). Polling de guerrilla con `RESTAURANT_PE_POS_TOKEN`. Payload y cancelación 100 % alineados a la spec oficial `RESTAURANT.PE/APIV2/2-oas3` (26/11/2020).

### Correcciones críticas que el Swagger nos forzó a aplicar

El plan anterior tenía dos errores derivados del DOM del POS que el spec oficial corrige:

1. **`delivery_modalidad`** es **modalidad de atención** (1 inmediato, 2 recojo, 3 programado), NO un flag delivery/pickup. Hoy estamos mandando `1` para delivery y `2` para pickup, lo cual encaja por casualidad (delivery=inmediato, pickup=recojo). Mantenemos ese mapeo (es semánticamente correcto) pero documentamos. Borramos la idea anterior de inventar un `delivery_tipo` paralelo.
2. **Coordenadas**: el spec las nombra `delivery_latitud` / `delivery_longitud` (string), no `delivery_lat` / `delivery_lng`. Renombramos.
3. **Notas del pedido**: el campo oficial es `delivery_notageneral`, no `delivery_observacion`. Renombramos manteniendo el legado por compatibilidad de logs.
4. **`delivery_codigointegracion`** requiere `canaldelivery_id` para activar la deduplicación. Enviamos ambos.

### Fase 1 — `submitOrder` 100 % alineado al spec V2

Archivo: `src/lib/orders.server.ts` (objeto `payload`).

**En `payload.delivery`:**

- Renombrar `delivery_lat` → `delivery_latitud` y `delivery_lng` → `delivery_longitud`. Convertir a `string` (el spec los pide string) o `null` si no hay.
- Renombrar `delivery_observacion` → `delivery_notageneral`. Si queremos cinturón-y-tirantes, dejar también `delivery_observacion` con el mismo valor por compatibilidad con el POS legacy (un campo extra no rompe).
- Añadir `delivery_comprobante: 1` (boleta).
- Añadir `delivery_codigointegracion: localId` (UUID local → antiduplicación).
- Añadir `canaldelivery_id: 1` (constante de canal "API/Web"; requerido para que `delivery_codigointegracion` tenga efecto). Si el cliente quiere otro id de canal, lo parametrizamos vía env `RESTAURANT_PE_CANAL_ID` con default `1`.
- Añadir `emitSocket: false` (el spec lo marca deprecado; lo seteamos explícito).
- `delivery_modalidad`: mantener `1` para delivery e `2` para pickup. Añadir comentario inline explicando que coincide con "1=inmediato, 2=recojo" del spec.
- `delivery_origentipo: 3` lo dejamos (no está en el spec pero el POS lo respeta y no rompe el envelope).
- Mantener intacto: `delivery_tipopago`, `tarjeta_id`, `delivery_pagocon`, `delivery_montopagado`, `delivery_pago_pendiente`, `delivery_montodescuento`, `delivery_direccionenvio`, `delivery_referencia`, `delivery_numero`, `pedido_observacion` con modificadores (Fase 1 anterior).

**En `payload.cliente`:**

- Añadir `cliente_tipo: 0` (natural).
- Añadir `validacion_cliente: 4` (por teléfono).
- `cliente_dniruc` ya se manda como `""`; el spec lo marca requerido pero acepta cadena vacía cuando `validacion_cliente=4`.
- Mantener `cliente_observacion` (no está en el spec pero el POS v2 lo imprime).

### Fase 2 — Cancelación bidireccional

A) `src/lib/restaurantpe.server.ts`: nueva función

```ts
export async function rpCancelarDelivery(
  deliveryId: number | string,
  motivo: string,
): Promise<{ ok: boolean; mensaje?: string }>
```

- URL: `${HOST}/readonly/rest/delivery/cancelarDelivery/${dominioId}` (POST).
- Body: `{ delivery_id: Number(deliveryId), delivery_motivocancelacion: motivo }`.
- Auth: `RESTAURANT_PE_TOKEN`. Timeout 10s.
- Si `tipo === "1"` → `{ ok: true }`. Si no, log en `rp_sync_log` (`tipo:"cancel_pedido"`, `ok:false`) y devolver `{ ok: false, mensaje }`. No lanzar.

B) `src/lib/admin-orders.functions.ts` (`updateOrderStatusAdmin`):

- Cuando `data.status === "cancelado"`:
  1. `select rp_pedido_id` de la fila (lectura admin previa al update).
  2. Si existe → `await rpCancelarDelivery(rp_pedido_id, cancelReason ?? "Cancelado desde la web")` (tolerante a fallo).
  3. Aplicar siempre el UPDATE local con `status`, `cancel_reason`, `cancelled_at`.
- Devolver `{ ok: true, posCancelled: boolean, posError?: string }`. La UI puede ignorar el extra hoy.

### Fase 3 — Tracking interno (polling con POS token)

A) `src/lib/restaurantpe.server.ts` — refactor `rpObtenerDelivery`:

- Eliminar los 4 candidatos contra `api.restaurant.pe` (`obtenerDelivery`/`obtenerEstadoDelivery` no existen en el spec).
- Único candidato: `http://${sub}.restaurant.pe/restaurant/api/rest/pedido/getPedidoListByDelivery/${deliveryId}` con `Authorization: Token token="${RESTAURANT_PE_POS_TOKEN}"`.
- Si `RESTAURANT_PE_POS_TOKEN` está vacío/no definido → `return null` sin loggear (no-op silencioso).
- Si HTTP != 200 o `tipo !== "1"` → log dedupe 10 min y `return null`.
- Mantener shape `{ raw, delivery }`.

B) `src/lib/restaurantpe-normalize.ts` — `mapDeliveryEstado`:

Mapeo del **endpoint interno del POS** (NO confundir con la tabla `statusCode` del webhook oficial, que ignoramos):

- `1 → "recibido"`
- `2 → "en_preparacion"`
- `3 → "en_camino"`
- `4 → "cancelado"`
- `5 → "entregado"` (cierra ciclo si el POS interno lo emite)
- `0` / otros → `null`

> Nota: el spec del webhook (`0=cancelado, 2=confirmado, 3=en camino, 4=entregado`) es distinto al del endpoint interno (`delivery_estado`). Como no usamos webhooks, mapeamos sólo el interno.

C) `src/components/kp/TrackerOperativo.tsx`:

- Quitar `setTimeout(tick, 1500)` y `setInterval(tick, 10_000)`.
- Reemplazar por: un disparo inmediato `tick()` justo después del `fetchOrder()` inicial, y `setInterval(tick, 15_000)`.
- Mantener guarda `prevStatusRef` (terminales: `entregado`, `cancelado`, `error`).
- Mantener `.catch(() => {})` → fallo silencioso, Realtime queda como fuente de verdad.

D) Webhook receiver: la carpeta `src/routes/api/` está vacía. Nada que borrar. Sólo se confirma en build.

### Verificación post-deploy

1. Pedido nuevo → en `rp_sync_log.payload.request.delivery` deben aparecer: `delivery_latitud`, `delivery_longitud`, `delivery_notageneral`, `delivery_comprobante:1`, `delivery_codigointegracion:<uuid>`, `canaldelivery_id`. En `cliente`: `cliente_tipo:0`, `validacion_cliente:4`.
2. Reintentar el mismo pedido (mismo `delivery_codigointegracion`) → el POS no debe duplicar.
3. Con `RESTAURANT_PE_POS_TOKEN`: tracker levanta `rp_numero_comanda` en ≤15 s, avanza estado al cambiar en cocina.
4. Sin `RESTAURANT_PE_POS_TOKEN`: tracker silencioso, sólo Realtime.
5. Cancelación desde `/admin/pedidos` → `rp_sync_log` con `tipo:"cancel_pedido"` `ok:true`; el pedido desaparece/aparece anulado en la pantalla de cocina.

### Archivos tocados

- `src/lib/orders.server.ts` (payload completo alineado al spec)
- `src/lib/restaurantpe.server.ts` (`rpCancelarDelivery`, refactor `rpObtenerDelivery`)
- `src/lib/restaurantpe-normalize.ts` (mapping numérico interno)
- `src/lib/admin-orders.functions.ts` (cancelación bidireccional)
- `src/components/kp/TrackerOperativo.tsx` (polling 15 s)

Sin migraciones. Sin secretos nuevos obligatorios (`RESTAURANT_PE_CANAL_ID` opcional con default `1`).
