## Problema

El pedido `0d44af4a` (rp_pedido_id=**164184**) recibió webhooks para `deliveryId=163982` y `163993` — pedidos que **no son suyos** — y fue marcado `en_camino` → `entregado` sin que Restaurant.pe haya enviado un solo webhook con su deliveryId real (164184).

Causa raíz confirmada en BD: ambos webhooks matchearon vía **`fallback_single`** (el match "si hay exactamente un pedido web reciente, es ese"). Esa regla es estructuralmente insegura:

- Restaurant.pe parece enviar webhooks de **otros deliveries de la cuenta** a nuestra URL (no sólo los nuestros).
- Mientras haya un único pedido web reciente no terminal, cualquier webhook ajeno lo "secuestra".
- Peor: tras matchear por fallback, persistimos el alias en `rp_response.webhook_delivery_ids`, así que el siguiente webhook de ese deliveryId ajeno vuelve a caer en el mismo pedido vía `alias`.

El guardarraíl que pusimos la vuelta pasada (alias sólo si no terminal + reciente) **no ayuda aquí** porque el daño ocurre en el primer fallback, antes de que el pedido sea terminal.

## Fix propuesto (quirúrgico)

### 1. Eliminar `fallback_single` del webhook

En `src/routes/api/public/rp-webhook.ts`:

- Quitar la rama `fallback_single` de `resolveOrderForWebhook`. Sólo quedan tres rutas válidas:
  1. `integration` — match por `delivery_codigointegracion` (UUID local, lo que ya enviamos en `registrarDelivery`).
  2. `direct` — `orders.rp_pedido_id == deliveryId`.
  3. `alias` — pero **sólo si fue aprendido por `integration` o `direct`** (ver punto 2).
- Si nada matchea → log `webhook_ignored_external` y 200 OK. Mejor ignorar que contaminar.

### 2. Dejar de aprender alias desde matches débiles

- `persistAlias()` y la rama de update sólo agregan a `webhook_delivery_ids` cuando `linkReason ∈ {integration, direct}`.
- Nunca cuando viene de match laxo. Esto evita que un alias erróneo del pasado se perpetúe.

### 3. Log claro cuando llega webhook ajeno

- Mantener `webhook_ignored_external` con el deliveryId y statusCode para diagnóstico, sin tocar ningún pedido.
- Esto deja visible en el panel "esto es de otro restaurante / otro pedido, ignorado correctamente".

### 4. Limpieza de datos contaminados

Migración / UPDATE de un solo uso:

- Para el pedido `0d44af4a`: revertir `status` al último estado **confirmado por el flujo de envío** (probablemente `enviado` — fue lo que dejó `orders.server.ts` tras `registrarDelivery`; no hubo confirmación real del POS).
- Limpiar `rp_response.webhook_delivery_ids`, `webhook_status_history`, `webhook_link_reason` para que no quede el alias 163982/163993.
- Barrer cualquier otro pedido con `webhook_link_reason = 'fallback_single'` y deshacer los cambios derivados (revertir a `enviado`, limpiar aliases).

Antes de ejecutar la limpieza te muestro la lista de pedidos afectados para que la apruebes.

## Lo que NO cambia

- `registrarDelivery` sigue mandando `delivery_codigointegracion` (UUID) — es la llave canónica. Si RP la respeta en el webhook, todo matchea por `integration` sin ambigüedad.
- `RP_EMIT_SOCKET` sigue controlado por env (la decisión anterior).
- No se toca el flujo de envío al POS, ni la creación de pedidos, ni el tracker.

## Riesgo conocido / trade-off

Si Restaurant.pe **no** envía `delivery_codigointegracion` en algún webhook y el `deliveryId` que sí manda no coincide con nuestro `rp_pedido_id` guardado, ese pedido **no se actualizará automáticamente** y quedará en `enviado` hasta que el operador lo mueva o llegue un webhook bien identificado. Es preferible a marcar pedidos al azar como entregados.

Para mitigar: dejar el log `webhook_ignored_external` muy visible en `/admin/integraciones` para detectar el patrón y, si pasa seguido, abrir ticket con RP pidiendo que respete `delivery_codigointegracion`.

## Detalles técnicos

Archivos a tocar:
- `src/routes/api/public/rp-webhook.ts` — eliminar `fallback_single`, restringir `persistAlias` a integration/direct.
- Migración SQL — revertir pedidos contaminados (lista a confirmar contigo antes).

Sin cambios en: `orders.server.ts`, `restaurantpe.server.ts`, UI, Realtime, Auto-Kill TTL.
