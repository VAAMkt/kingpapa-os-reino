## Resultado de la prueba (159749)

Confirmado empíricamente: **Restaurant.pe NO emite webhook al cancelar desde la lista de pendientes**. Para el `deliveryId=159749` no llegó ningún POST a `/api/public/rp-webhook` (0 registros `webhook_raw`). El último webhook recibido fue del 159666, que sí fue aceptado y recorrió `2→3→4` completos.

## Plan

### A) Matar el polling residual (causa real de los `poll_pedido` que vimos en logs)

**Archivo:** `src/components/kp/TrackerOperativo.tsx`
- Eliminar el `import { pollOrderFromRp } from "@/lib/orders.poll.functions"`.
- Eliminar `useServerFn` import si ya no se usa en el archivo.
- Eliminar el bloque `useEffect` con `setInterval` (líneas ~104–117) que llama a `pollFn` cada 60s.
- El componente queda 100% reactivo a Supabase Realtime (que ya funciona).

**Archivo:** `src/lib/orders.poll.functions.ts`
- Conservar **solo** `resolveOrderId` (lo usa `src/routes/gracias.tsx`).
- Eliminar la export `pollOrderFromRp` y cualquier helper interno que solo ella use.
- Si tras la limpieza el archivo queda solo con `resolveOrderId`, renombrarlo conceptualmente está OK pero por ahora basta con borrar las funciones de polling sin renombrar el archivo (evita cambios de import en `gracias.tsx`).

**Archivo:** `src/lib/restaurantpe.server.ts`
- Eliminar el helper interno que ejecuta `obtenerDelivery` y el insert de `tipo='poll_pedido'` en `rp_sync_log` (líneas ~290–350 según grep). Esta función ya solo era consumida por `pollOrderFromRp`.
- Verificar con grep final que nadie más la importa antes de borrar.

### B) Borrador de ticket para soporte Restaurant.pe

Generar un archivo **`/mnt/documents/rp-soporte-webhook-cancelacion.md`** con un reporte técnico listo para enviar por email/WhatsApp a soporte de Restaurant.pe. Contenido:

- **Asunto:** Webhook V2 no notifica `statusCode=0` al cancelar deliverys desde el POS
- **Dominio / local_id:** `5272` / `9` (KingPapa Limonar)
- **Endpoint receptor configurado:** `https://kingpapa-os-reino.lovable.app/api/public/rp-webhook?t=***`
- **Comportamiento esperado** (según Swagger V2 `2-oas3`, POST `/webhook`): recibir `{deliveryId, statusCode:"0"}` cuando un pedido se anula desde el POS.
- **Comportamiento observado:** evidencia con 3 casos
  - ✅ `delivery 159666` (aceptado y entregado): recibimos `statusCode=2,3,4` correctamente, timestamps UTC.
  - ❌ `delivery 159734` (cancelado desde lista de pendientes): ningún POST recibido.
  - ❌ `delivery 159749` (cancelado desde lista de pendientes ~04:04 UTC, 2026-06-02): ningún POST recibido.
- **Hipótesis:** el evento `statusCode=0` solo se dispara para pedidos previamente aceptados, no para los que se cancelan directamente desde la cola.
- **Solicitud:** confirmar si es bug o comportamiento esperado, y si existe forma de habilitar la notificación para cancelaciones de pedidos pendientes (o publicar un evento equivalente, ej. `statusCode="-1"` para rechazo).

Sin cambios en backend ni UI fuera de lo anterior.
