# Fix 401 Reconcile — Discovery + Fallback explícito

## Diagnóstico (sin cambios)

`registrarDelivery` ✅ → `api.restaurant.pe/restaurant/public/v2/...` con `RESTAURANT_PE_TOKEN`.
`reconcileOrder` ❌ → `https://kingpapa.restaurant.pe/restaurant/api/rest/delivery/get/{id}` devuelve `tipo:"401", tokenValido:"0"` en todos los nodos. El token de dominio **no aplica** al host por tenant.

## Estrategia: dos fases

### Fase A — Discovery (server-side, sin tocar UI ni schema)

Antes de escribir cualquier reemplazo, ejecuto pruebas reales con `RESTAURANT_PE_TOKEN` contra `api.restaurant.pe` para descubrir si existe un GET público que devuelva el estado actualizado del delivery. Plan de prueba (con el `rp_pedido_id = 163776` que ya tienes en la DB):

1. Escribir un server function **temporal** `rpDiscoverDelivery` que, dado un `delivery_id`, pruebe en orden los candidatos más razonables y devuelva `{ path, status, tipo, mensajes, hasEstado, sample }` para cada uno:

   - `GET /readonly/rest/delivery/get/{dominio_id}/{id}`
   - `GET /readonly/rest/delivery/obtenerSyncFull/{dominio_id}/{id}`
   - `GET /readonly/rest/delivery/obtenerDelivery/{dominio_id}/{id}/0`
   - `GET /public/v2/rest/delivery/get/{dominio_id}/{id}`
   - `GET /public/v2/rest/delivery/obtenerSyncFull/{dominio_id}/{id}`
   - `GET /public/v2/rest/delivery/obtenerDelivery/{dominio_id}/{id}/0`

   Todos con `Authorization: Token token="${RESTAURANT_PE_TOKEN}"`. Mismo header que `registrarDelivery`.

2. Invocar con `stack_modern--invoke-server-function` y leer la respuesta. Criterio de éxito: al menos un path devuelve `tipo:"1"` y un objeto donde `extractEstado()` encuentra `delivery_estado` no vacío.

3. Loggear todo en `rp_sync_log` con `tipo='discovery'` para que quede traza.

### Fase B — Decisión basada en evidencia

**Caso 1: hay endpoint público que devuelve estado real**
- Reemplazo `rpGetDeliveryById` / `rpObtenerSyncFull` por el endpoint descubierto, usando `READ_BASE` o `WRITE_BASE` según corresponda (mismo `rpFetch`, mismo token, misma firma).
- Elimino `buildTenantBase`, `getDominioHost`, `rpFetchTenant`, `TENANT_TIMEOUT_MS`.
- `orders.reconcile.functions.ts` solo cambia los nombres de funciones llamadas; el resto (TTL 45 min, rate-limit 20s, mapeo, logging) intacto.
- Borro el server fn de discovery.

**Caso 2: ningún endpoint público devuelve estado actualizado**
- Reconcile pull queda **descartado** como tal.
- Elimino `rpGetDeliveryById`, `rpObtenerSyncFull`, `rpFetchTenant`, `buildTenantBase`, `getDominioHost` — dejan de generar ruido 401 en `rp_sync_log`.
- En `orders.reconcile.functions.ts`, `reconcileOne` queda **solo** con la regla de Auto-Kill 45 min + el rate-limit; cualquier llamada antes de los 45 min responde `{ source: "noop", message: "reconcile_unavailable" }` y no toca RP.
- En `TrackerOperativo`, el backoff sigue programando `reconcileOrder` (sin penalidad: server responde noop barato), de modo que cuando una sesión cruza los 45 min dispare el Auto-Kill.
- Dependemos 100% del webhook + Auto-Kill. Te aviso explícitamente para que decidas si subir prioridad de soporte con RP para obtener un token tenant válido.

## Lo que NO se toca en ninguno de los dos casos

- Webhook `/api/public/rp-webhook`, `registrarDelivery`, `cancelarDelivery`, `verificarProductosAgotados`.
- TTL 45 min y Auto-Kill en `orders.reconcile.functions.ts`.
- `extractEstado()`.
- Frontend: `TrackerOperativo`, `/gracias`, `/admin/integraciones`.
- Schema, RLS, migrations, secrets.

## Salida que verás al terminar la Fase A

Te pego en chat:
- Tabla de los 6 paths probados con `status`, `tipo`, primeros 200 chars de `mensajes` o `data`.
- Veredicto: **Caso 1** (con el path elegido) o **Caso 2** (sin endpoint viable).
- Solo entonces implemento la Fase B correspondiente.

¿Procedo con la Fase A?
