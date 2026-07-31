# Integración directa de Meta: API de Conversiones (CAPI) + Dataset Quality

Hoy KINGPAPA sólo envía eventos desde el navegador. Eso pierde entre 15% y 30% de las conversiones reales (iOS, bloqueadores, cierres de pestaña). La integración directa agrega un segundo canal: los mismos eventos salen también **desde el servidor**, y Meta los une por `event_id` sin contar doble.

Ya está el token guardado (`DATASET_QUALITY_API`), que sirve como token de acceso para llamar a la Graph API.

## Qué se va a construir

### 1. Envío de eventos servidor → Meta
Un módulo servidor que publica en la Graph API del dataset `1348178064148165`, con:
- `event_id` idéntico al del pixel del navegador → **deduplicación garantizada**.
- `user_data` hasheado en el servidor con SHA-256: teléfono (E.164 con 57), nombre, apellido, ciudad, país, más `fbp`/`fbc` (cookies del pixel), IP y user-agent reales del visitante. Esto es lo que más sube el *Event Match Quality*.
- `action_source: "website"` y `event_source_url` reales.
- Nunca rompe la app: cualquier fallo se registra y se ignora.

### 2. Espejo automático de los eventos que ya existen
Los eventos actuales (`ViewContent`, `Search`, `ViewCategory`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`, `Lead`) se reenvían en paralelo al servidor con el mismo `event_id`. No hay que instrumentar nada nuevo: se engancha en el punto único por donde ya pasan todos.

### 3. Purchase desde el servidor (el más importante)
`Purchase` se enviará desde el backend con `event_id = kp-order-<id>`, tomando el total y las líneas del pedido. Así una compra se registra aunque el cliente cierre la pestaña de `/gracias` o tenga bloqueador. Se guarda una marca en el pedido para no reenviarlo nunca dos veces.

### 4. Modo de prueba
Un `test_event_code` opcional (secret) para que los eventos aparezcan en **Probar eventos** de Meta mientras verificas, sin ensuciar los datos de producción. Se quita después.

### 5. Panel de calidad en /admin/integraciones
Una tarjeta que consulta la **Dataset Quality API** con el token guardado y muestra: proporción de coincidencia de eventos, cobertura de parámetros y eventos duplicados detectados. Sirve para comprobar que la deduplicación funciona sin entrar a Meta.

## Verificación

1. En Meta → Administrador de eventos → Probar eventos: recorrer menú → agregar → checkout → pedido.
2. Cada evento debe aparecer **una sola vez**, con origen "Navegador y servidor" (no duplicado).
3. La tarjeta de /admin/integraciones debe mostrar la coincidencia subiendo en 24–48 h.

## Detalle técnico

- `src/lib/capi.server.ts` — `sendCapiEvents(events)`; POST a `https://graph.facebook.com/v21.0/1348178064148165/events`; token leído dentro del handler (`DATASET_QUALITY_API`, con `META_CAPI_ACCESS_TOKEN` como override si más adelante quieres separar tokens); hash SHA-256 con `crypto` de Node; normalización de teléfono/ciudad idéntica a la del cliente.
- `src/lib/capi.functions.ts` — `sendMetaEvent` (`createServerFn`, pública) con validación Zod: lista blanca de nombres de evento, tope de tamaño de payload, sin campos libres. Lee IP y UA con `getRequestIP` / `getRequestHeader`.
- `src/lib/meta-pixel.ts` — `pixelTrack` y `pixelPurchase` devuelven el `eventID` usado y disparan el espejo servidor con `fbp`/`fbc` leídos de `document.cookie`; el envío es *fire-and-forget*.
- `src/lib/orders.server.ts` — al confirmar el pedido, encola el `Purchase` de servidor; columna nueva `meta_capi_sent_at` en `orders` (migración con GRANT) como candado de idempotencia.
- `src/lib/integrations.functions.ts` + `src/routes/admin.integraciones.tsx` — lectura de Dataset Quality API y tarjeta de métricas.
- Sin cambios en el flujo de pedidos, Restaurant.pe, tracker ni reconciliación.

## Fuera de alcance

Catálogo de productos en Meta y eventos offline (call center / WhatsApp). Quedan listos para después: el `content_id` ya está normalizado al id del catálogo.
