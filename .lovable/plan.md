# Plan: Conexión Restaurant.pe impecable (Swagger V2 oficial)

## Diagnóstico (qué está bien y qué no)

Comparando nuestro código actual contra el spec oficial `RESTAURANT.PE/APIV2/2-oas3`:

| Área | Estado actual | Brecha vs Swagger V2 |
|---|---|---|
| `registrarDelivery` | Enviamos ~10 campos | Faltan campos requeridos/útiles: `cliente_tipo`, `validacion_cliente`, `delivery_comprobante`, `delivery_codigointegracion` (antiduplica), `delivery_latitud/longitud`, `canaldelivery_id` |
| Tracking en vivo | Polling cada 20s a `obtenerDelivery` (endpoint no documentado, falla seguido) | Swagger expone **webhook push** (`/webhook` con `deliveryId` + `statusCode`) que NO estamos usando |
| Estados | Mapeamos 0..4 desde DOM del POS | Swagger oficial: `0=cancelado, 2=confirmado, 3=en camino, 4=entregado` (distinto de lo cacheado) |
| Cancelación | No usamos endpoint | Existe `cancelarDelivery` con `delivery_motivocancelacion` |
| Stock pre-checkout | No verificamos | Existe `verificarProductosAgotados` para evitar pedidos a productos sin stock |
| Reconciliación | No tenemos | Existe `obtenerVentasPorIntegracion` (ventas con `serie`, `correlativo`, `total`, `estado`) — fuente de verdad |
| Idempotencia | Si el cliente hace doble-click podemos duplicar pedidos en POS | `delivery_codigointegracion` previene duplicados a nivel POS |

## Cambios propuestos (priorizados por impacto)

### P0 — Tracking real-time vía webhook (elimina polling frágil)

**Nuevo:** `src/routes/api/public/rp-webhook.ts` (server route bajo `/api/public/*`).
- Recibe `POST { deliveryId, statusCode }` desde Restaurant.pe.
- Valida con Zod. Como Swagger no define firma HMAC, protegemos con un **token compartido en query string** (`?t=<secret>`) que guardamos como secret `RP_WEBHOOK_SECRET` y configuramos en el panel de Restaurant.pe.
- Mapea `statusCode` con la tabla oficial (`0→cancelado, 2→recibido, 3→en_camino, 4→entregado`) — sobrescribe el mapeo actual `0/1=recibido, 2=en_preparacion...` que vino del DOM legacy.
- `UPDATE orders SET status=..., cancelled_at=... WHERE rp_pedido_id = deliveryId`. Realtime ya propaga al `TrackerOperativo`.
- Loguea en `rp_sync_log` (tipo `webhook`).

**URL a registrar en Restaurant.pe** (Menu → Mi Restaurant → Integraciones → URI de actualización):
`https://project--340d46a4-b783-4a2a-a2a1-295d9ea3dcbc.lovable.app/api/public/rp-webhook?t=<RP_WEBHOOK_SECRET>`

### P0 — Mapeo de estados correcto

En `src/lib/restaurantpe-normalize.ts`, reemplazar la tabla del DOM por la oficial del Swagger. El polling de respaldo y el webhook comparten la misma función.

### P1 — Payload `registrarDelivery` completo

En `src/lib/orders.server.ts` (`submitOrder`), enriquecer el body:

```ts
delivery: {
  ...actual,
  delivery_codigointegracion: localId,        // UUID de orders.id → antiduplica
  delivery_comprobante: 1,                    // 1=boleta por defecto
  delivery_latitud: sede.lat ? String(...) : undefined,
  delivery_longitud: sede.lng ? String(...) : undefined,
  delivery_notageneral: input.notas ?? "",
  // canaldelivery_id: solo si Restaurant.pe nos asigna uno; preguntar a soporte
},
cliente: {
  ...actual,
  cliente_tipo: 0,            // 0=natural
  validacion_cliente: 4,      // 4=por teléfono (es lo que tenemos siempre)
  cliente_dniruc: input.cliente.dniruc ?? "",  // vacío permitido por Swagger
}
```

**Nota:** Requiere insertar `orders` ANTES de llamar al POS (ya lo hacemos) para tener el UUID que sirve como `delivery_codigointegracion`.

### P1 — Polling como respaldo (no como fuente primaria)

`pollOrderFromRp` se mantiene pero:
- Frecuencia baja de 20s → 60s.
- Solo corre si han pasado >2 min sin actualización vía webhook (campo `updated_at`).
- Si `obtenerDelivery` sigue fallando, fallback a `obtenerVentasPorIntegracion` filtrando por fecha del día y matcheando `delivery_codigointegracion` → trae `serie`, `correlativo`, `estado_txt` confiables.

### P2 — Pre-validación de stock

Nuevo wrapper `rpVerificarAgotados(localId, productIds[])` en `restaurantpe.server.ts`. Llamado al inicio de `submitOrder` antes de armar el payload. Si algún `agotado: true`, lanza error legible: "‘Pollo a la brasa’ se acaba de agotar, recarga el menú".

### P3 — Cancelación desde admin

Nuevo server fn `cancelOrder({ orderId, motivo })` que llama a `POST /cancelarDelivery` con `delivery_id` + `delivery_motivocancelacion`. Botón en `admin.pedidos.tsx`. (Opcional, pedirlo cuando se necesite.)

## Detalles técnicos

- **Idempotencia del webhook:** mismo `statusCode` entrante 2× = no-op (comparamos contra `orders.status` antes de UPDATE).
- **Seguridad webhook:** el query token `?t=` es suficiente porque el endpoint solo hace UPDATE filtrado por `rp_pedido_id`; no expone datos. Si Restaurant.pe luego soporta firma HMAC, migramos.
- **Backwards compat:** `extractDeliveryEstado` y el shim `obtenerDelivery` quedan, pero el webhook es la vía rápida.
- **Logs:** todo movimiento de estado registra en `rp_sync_log` con `tipo: webhook | poll_pedido | order | cancel` para auditoría.

## Out of scope (no toco en este PR)

- `obtenerComprasPorIntegracion` (compras de insumos — no afecta cliente final).
- Integración con motorizado en mapa real-time (Swagger no expone GPS del motorizado, solo nombre/teléfono).
- Reemplazar pasarela de pago online (`delivery_tipopago=5`); cuando se integre, ya tenemos el slot.

## Validación

1. Hacer un pedido en `/menu` → checkout → ver `delivery_codigointegracion` en `rp_sync_log`.
2. Disparar el webhook manualmente: `curl -X POST '<url>?t=...' -d '{"deliveryId":<id>,"statusCode":3}'` → `TrackerOperativo` debe pasar a "Motorizado en camino" en <2s vía Realtime.
3. Confirmar en el POS que el pedido aparece UNA sola vez aunque hagamos doble-click en "Pagar".

## Pregunta para ti antes de implementar

¿Procedo con **P0 + P1** (webhook + mapeo correcto + payload completo + idempotencia) en este turno y dejamos P2/P3 para iteraciones? ¿O prefieres que arranque solo con el webhook (P0) para validar end-to-end antes de tocar el payload?
