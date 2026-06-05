
## Diagnóstico

Dos problemas distintos, uno ya resuelto por ti y otro pendiente en código.

### 1. URL del webhook ✅ (ya corregida por ti)
Reemplazaste la URI en Restaurant.pe por `https://kingpapa.co/api/public/rp-webhook?t=e80c1ecaebafdaf22e40c5b98e453907` (sin `<>`). Pendiente: validar con un POST real (los logs actuales en BD son anteriores al fix; siguen apuntando al host viejo sin token).

### 2. Mapeo de `statusCode` incorrecto en el código ❌
Mirando `rp_sync_log`:

- Cuando hiciste **anular** desde el POS → llegaron `statusCode: "2"` (deliveries 160158-160164).
- Cuando hiciste **cancelar/rechazar** desde el POS (prueba previa) → llegaron `statusCode: "3"` (deliveries 160070-160075, 160159).

Pero `src/lib/restaurantpe-normalize.ts → mapWebhookStatusCode()` mapea:
```
0 → cancelado
2 → recibido      ← debería ser cancelado (anular)
3 → en_camino     ← debería ser cancelado (cancelar/rechazar)
4 → entregado
```

Resultado: aunque el webhook llegara con token válido, **"anular" en el POS marcaría el pedido como "recibido"** y "cancelar" como "en_camino". El cliente nunca vería "Pedido cancelado" en `/gracias`.

El comentario actual cita el Swagger oficial v2, pero la realidad observada del POS difiere. Tres webhooks distintos de tres acciones distintas confirman el patrón.

## Cambios

### Paso 1 — Corregir `mapWebhookStatusCode` en `src/lib/restaurantpe-normalize.ts`

Nuevo mapeo basado en evidencia empírica:

```ts
case 0: return "cancelado";     // (según Swagger; sin evidencia, lo dejo)
case 2: return "cancelado";     // anular desde el POS — observado
case 3: return "cancelado";     // cancelar/rechazar desde el POS — observado
case 4: return "entregado";     // (según Swagger)
```

Actualizar también el comentario del bloque explicando que el mapeo se basa en comportamiento real del POS, no en el Swagger.

**Nota:** Restaurant.pe **no envía** webhooks para "en preparación" / "en camino" (al menos no con los códigos del Swagger). Esos estados intermedios se siguen actualizando por el poller que lee `obtenerDelivery` (sin tocar — ya funciona). El webhook solo dispara transiciones terminales.

### Paso 2 — Verificación tras tu nueva prueba

Cuando dispares una anulación de prueba (con la URL ya corregida en RP), consulto `rp_sync_log` y confirmo:
- `query_token_match: true` en el `webhook_raw`.
- Un log `tipo='webhook'` con `enviado → cancelado` (no `→ recibido`).
- `orders.status='cancelado'` + `cancel_reason='Cancelado desde el POS'`.
- `/gracias` muestra "Pedido cancelado" vía Realtime sin recargar.

## Lo que NO toco

- `src/routes/api/public/rp-webhook.ts` — el endpoint en sí está bien (LOG-FIRST, validación de token, fallo suave, update).
- `TrackerOperativo.tsx` — ya está suscrito vía Realtime y muestra estado cancelado correctamente.
- Polling de `obtenerDelivery` — sigue cubriendo los estados intermedios.

## Confírmame

¿Aplico el fix del mapeo y luego validamos juntos con una prueba real?
