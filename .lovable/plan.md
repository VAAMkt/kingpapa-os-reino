# Limpieza radical: adiós polling, adiós "Asignando comanda…"

Volvemos a una arquitectura limpia: **el webhook público de Restaurant.pe es la única fuente de verdad**, y Supabase Realtime empuja los cambios al cliente. Se borra todo el polling de guerrilla y la UI deja de esperar el `rp_numero_comanda`.

## 1. Borrar el polling del POS

- Eliminar la server function `pollOrderFromRp` de `src/lib/orders.poll.functions.ts`.
- Mantener en ese mismo archivo `resolveOrderId` (sigue siendo útil para `/gracias` y links viejos de WhatsApp con `rp_pedido_id` numérico).
- Quitar el secreto `RESTAURANT_PE_POS_TOKEN` de la lectura en código (el secreto puede quedar en Cloud, ya no se usa).
- En `src/routes/admin.integraciones.tsx`, quitar la fila "pos cookie" del panel de estado RP.
- En `src/lib/integrations.functions.ts`, eliminar el campo `pos_token_set` del status (revisar y limpiar).

## 2. Tracker 100% reactivo

En `src/components/kp/TrackerOperativo.tsx`:

- Quitar el `setInterval` de 20s y cualquier `useServerFn(pollOrderFromRp)`.
- Conservar:
  - Fetch inicial directo a `orders` por UUID.
  - Suscripción Realtime a `postgres_changes` sobre `public.orders` filtrada por `id=eq.<uuid>`.
- Quitar el estado/branch que muestra "Asignando comanda…" mientras `rp_numero_comanda` está vacío.
- Donde antes se mostraba `#{rp_numero_comanda}`, mostrar `#{rp_pedido_id}` (el deliveryId que devuelve `registrarDelivery` desde el segundo cero).

## 3. Limpiar `/gracias`

En `src/routes/gracias.tsx`:

- Sustituir cualquier referencia visible a `rp_numero_comanda` por `rp_pedido_id`.
- Mantener `resolveOrderId` como red de seguridad para links antiguos (`?order_id=160364`).
- Texto de referencia para el cliente: **"Pedido Restaurant.pe #160366"** (basado en `rp_pedido_id`).

## 4. Webhook (verificación, sin cambios funcionales)

Revisar `src/routes/api/public/rp-webhook.ts` para confirmar y dejar documentado que:

- Sigue **público** bajo `/api/public/*` (sin token `?t=`).
- Sigue aceptando `tiempoEnvio` (JSONB) y matcheando por `delivery_codigointegracion` (nuestro UUID) o por `rp_pedido_id`.
- Es el **único** camino que muta `status` (`recibido → en_preparacion → en_camino → entregado → cancelado`).

No se tocan reglas de validación ni firma; solo se verifica.

## 5. Módulo Integraciones

En `src/routes/admin.integraciones.tsx`:

- Quitar la opción `pos_poll` del filtro de tipos (ya no se generarán esos logs).
- Resto del módulo (estado RP/Lovable/Maps + stream realtime de `rp_sync_log` + buscador) queda igual.

## Detalles técnicos

**Archivos a editar**
- `src/lib/orders.poll.functions.ts` — borrar `pollOrderFromRp`, dejar solo `resolveOrderId`.
- `src/components/kp/TrackerOperativo.tsx` — borrar interval + polling, mostrar `rp_pedido_id`.
- `src/routes/gracias.tsx` — reemplazar referencias a `rp_numero_comanda` por `rp_pedido_id`.
- `src/lib/integrations.functions.ts` — quitar `pos_token_set`.
- `src/routes/admin.integraciones.tsx` — quitar fila "pos cookie" y opción `pos_poll`.

**No se toca**
- Tabla `orders` (columna `rp_numero_comanda` se queda; puede llegar a poblarse vía webhook el día que RP lo mande, pero la UI ya no la requiere).
- Migrations.
- Lógica del webhook ni del flujo de checkout.
- `src/lib/orders.server.ts` (el fix de `orderId: localId` ya está aplicado).

**Resultado esperado**
- Cero llamadas ocultas al POS interno.
- `/gracias` carga al instante con `#rp_pedido_id` visible y se actualiza por Realtime cuando el webhook escribe en `orders`.
- Código mantenible, sin cookies que caducan, sin endpoints no documentados.
