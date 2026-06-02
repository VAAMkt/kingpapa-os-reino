## Objetivo

Endurecer `src/routes/api/public/rp-webhook.ts` para que sirva como sonda empírica usando la tabla existente `rp_sync_log`. Cero UI nueva, cero migraciones, cero rutas nuevas.

## Cambios (un solo archivo: `src/routes/api/public/rp-webhook.ts`)

1. **Log-first crudo, antes de cualquier validación**
   - Capturar `request.text()` y la IP (`cf-connecting-ip` o `x-forwarded-for`).
   - INSERT inmediato en `rp_sync_log` con `tipo='webhook_raw'`, `ok=true`, `mensaje='POST recibido'`, y `payload = { raw: bodyText, source_ip, headers_subset, query_token_present }`.
   - Esto ocurre SIEMPRE, incluso si después el JSON es inválido, el token está mal, o el pedido no existe. Así verificamos empíricamente si RP dispara el webhook al cancelar desde el POS.

2. **Validación de token después del log crudo**
   - Si el token no coincide, igual quedó el `webhook_raw`. Devolver 401.

3. **Coerción defensiva de tipos** (ya existe parcial, reforzar)
   - `statusCode` acepta `"0" | 0 | "2" | 2 | ...`. El `z.union([z.number(), z.string()]).transform(v => String(v).trim())` actual cubre esto — verificar que `mapWebhookStatusCode` también normalice (trim + toString) y no falle por whitespace.

4. **Fallo suave: siempre HTTP 200 tras el log inicial**
   - Cambiar los actuales `400` (payload inválido) y `422` (statusCode desconocido) a **`200 OK`** con cuerpo `"ok"`. El error queda registrado en `rp_sync_log` con `ok=false`, pero RP recibe 200 para que no desactive el webhook.
   - Mantener `401` solo para token inválido (eso sí es legítimo rechazar).
   - El `500` actual cuando falla el `UPDATE` también baja a `200` (lo registramos como `ok=false`).

5. **Cancelación desde POS (`statusCode=0`)** — ya está bien implementado, solo confirmar:
   - UPDATE `orders` → `status='cancelado'`, `cancelled_at=now()`, `cancel_reason='Cancelado desde el POS'`.
   - Esto dispara Supabase Realtime y `/gracias` cambia a estado cancelado en el cliente automáticamente (ya hay suscripción).

## Cómo verificar (sin código nuevo)

1. Hacer un pedido de prueba desde la web.
2. Cancelarlo desde el POS de Restaurant.pe.
3. Abrir Supabase → Table Editor → `rp_sync_log`, ordenar por `created_at desc`.
4. Buscar fila `tipo='webhook_raw'` con el `deliveryId` correspondiente.
   - **Si aparece con `statusCode=0`** → RP sí notifica cancelaciones, listo.
   - **Si no aparece nada en 1–2 min** → confirmación empírica de que RP no dispara webhook para cancelaciones del POS y hay que escalar con soporte.

## Lo que NO se hace

- ❌ Nueva tabla `webhook_logs`
- ❌ Ruta `/admin/webhook-diagnostico`
- ❌ Componentes de UI, simulador, badges
- ❌ Server functions nuevas
- ❌ Modificar `orders`, `restaurantpe.server.ts`, `TrackerOperativo.tsx`, o cualquier otro archivo
