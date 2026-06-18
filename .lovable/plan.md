# Endurecer correlación del webhook de Restaurant.pe (v2 — con ajustes obligatorios)

## Objetivo
Cerrar la grieta de correlación entre el webhook de Restaurant.pe y `orders` usando `delivery_codigointegracion` como llave primaria, con guardarraíles de seguridad, anti-regresión y separación clara de semánticas de estado.

## Cambios en código

### 1. `src/routes/api/public/rp-webhook.ts` — GET público mínimo
Reemplazar el GET protegido por token por un descriptor sin datos sensibles:

```ts
GET: async () => Response.json({ ok: true, service: "kingpapa-rp-webhook" })
```

El POST sigue siendo el contrato real del webhook.

### 2. Parser tolerante con **semántica explícita** (Ajuste 2)
Nueva función `parseWebhookPayload(bodyText)`:
- Intenta `JSON.parse`; si falla, `URLSearchParams`.
- Acepta alias **solo** dentro de la misma semántica del webhook actual:
  - `deliveryId | delivery_id | deliveryid | id`
  - `statusCode | status_code` (**sin** `delivery_estado` ni `estado` — esos tienen mapper distinto y mezclarlos haría que `2` se interprete mal: en webhook es `recibido`, en `delivery_estado` es `en_preparacion`).
  - `tiempoEnvio | tiempo_envio | eta | eta_min`
  - `delivery_codigointegracion | codigoIntegracion | codigo_integracion | codigointegracion | external_id | order_id` → `integrationCode`.
- Devuelve `{ deliveryId, statusCode, tiempoEnvio, integrationCode, raw }`.
- El mapper usado sigue siendo `mapWebhookStatusCode` exclusivamente. Si en el futuro Restaurant.pe envía estado textual o `delivery_estado`, se añadirá un campo `statusSource` y mappers separados — fuera del alcance de este plan.

### 3. Resolver con **prioridad por `integrationCode` y guardarraíles** (Ajuste 1)
Nueva `resolveOrderForWebhook({ deliveryId, integrationCode })`:

1. Si `integrationCode` cumple TODAS estas condiciones, match directo:
   - es UUID v4 válido,
   - `orders.id == integrationCode`,
   - `status IN ('enviado','recibido','en_preparacion','en_camino')` (no terminal),
   - `created_at >= now() - 3h` (no viejo),
   - `rp_response IS NOT NULL` (efectivamente enviado a RP).
2. Si no, cae al `resolveOrderForDelivery(deliveryId)` actual: directo (`rp_pedido_id`) → alias aprendido → fallback único reciente.

Cuando matchea por `integrationCode`, persiste `deliveryId` en `rp_response.webhook_delivery_ids` para que webhooks posteriores (que podrían venir sin `integrationCode`) crucen por alias.

### 4. Anti-regresión de estado (Ajuste 3)
Antes de aplicar el `UPDATE`, comparar rangos:

```ts
const RANK = { enviado: 0, recibido: 1, en_preparacion: 2, en_camino: 3, entregado: 4, cancelado: 99, error: 99 };
```

Si `RANK[mapped] < RANK[row.status]`, **no** se actualiza; se loguea como `webhook_regression_ignored` y se responde 200. Protege contra reintentos fuera de orden o webhooks atrasados. La protección terminal (`TERMINAL` set) se mantiene encima.

### 5. Nuevos tipos de log y filtros admin
- `webhook_linked_integration` — match por `delivery_codigointegracion`.
- `webhook_regression_ignored` — descarte por rango.
- Añadirlos al array `TIPOS` en `src/routes/admin.integraciones.tsx`.

### 6. `src/lib/restaurantpe.server.ts` — captura completa de IDs (Ajuste 4)
Ampliar candidatos al extraer ids del POS, en este orden:

```
r.delivery_id, r.deliveryId,
r.data?.delivery_id, r.data?.deliveryId,
r.delivery?.delivery_id, r.delivery?.id,
// legacy
r.pedido_id, r.id, r.comanda, r.numero, r.numero_pedido,
r.data?.pedido_id, r.data?.id
```

Guardar **separadamente** dentro de `rp_response`:

```ts
{
  rp_pedido_id,            // mejor candidato pedido
  rp_delivery_id,          // mejor candidato delivery (si existe)
  rp_numero_comanda,       // si vino
  delivery_codigointegracion: localId,
  registered_at,
  raw_pos_response,
}
```

`orders.rp_pedido_id` (columna) se sigue alimentando con la misma prioridad de candidatos (para no romper el match directo del resolver), pero `rp_response` queda como fuente de verdad rica.

### 7. UI — alinear pasos del tracker a estados reales
`TrackerOperativo` (y vistas relacionadas): pasos visibles

```
Recibimos tu pedido → Cocina confirmó → Motorizado en camino → Entregado
```

Eliminar "Coronando en cocina" como paso real. El estado `en_preparacion` queda soportado en backend (por si llega), pero el UI no lo promete porque hoy el webhook no lo emite.

## Detalles técnicos
- Sin migraciones de schema. `rp_response` ya es JSON libre.
- No se toca `auth-middleware`, RLS, `client.server.ts`, ni se reactiva polling/reconcile (Fase A confirmó 401/404).
- Auto-Kill TTL 45 min se mantiene como red de seguridad.
- `mapWebhookStatusCode` intacto: `0→cancelado, 2→recibido, 3→en_camino, 4→entregado`.

## Acción manual (fuera de código)
Solicitar a Restaurant.pe que el webhook incluya `delivery_codigointegracion` en el body. El código ya queda listo para consumirlo en cuanto llegue; mientras tanto, el resolver opera con direct → alias → fallback como hoy, pero con guardarraíles más estrictos.

## Validación
1. Crear pedido real en producción y cambiar estado en el POS.
2. En `/admin/integraciones` verificar `webhook_raw` + log de éxito (`webhook`, `webhook_linked_fallback`, o `webhook_linked_integration` cuando RP envíe el campo).
3. Lanzar dos pedidos cuasi-simultáneos y verificar que cuando llegue `integrationCode` ya no aparece `webhook_ambiguous`.
4. Forzar un webhook "atrasado" (estado anterior) y verificar `webhook_regression_ignored`.
5. Verificar que `orders.status` actualiza y `TrackerOperativo` se mueve por Realtime sin recargar.
6. Verificar que el paso "Coronando en cocina" ya no aparece en el tracker.

## Fuera de alcance
- Mapper separado para `delivery_estado` y estado textual (se añadirá cuando se confirme payload real).
- Migración de columnas `rp_delivery_id` / `rp_numero_comanda` como columnas first-class (por ahora viven en `rp_response`).
- Cualquier reactivación de polling contra RP.
