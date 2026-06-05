## Hallazgo crítico al releer la doc oficial (OAS 3.0, 30/07/2024)

La doc oficial dice claramente:

> `statusCode`: 0 cancelado, **2 confirmado**, **3 en camino**, 4 entregado

Y los webhooks reales recientes (kingpapa.co) lo confirman:

- `sc=3` viene con `tiempoEnvio: "30"` → es **en camino** con ETA en minutos.
- `sc=2` viene sin `tiempoEnvio` → es **confirmado/recibido** (cocina aceptó).
- `sc=4` → entregado.

**El mapeo "empírico" anterior (2→cancelado, 3→cancelado) estaba mal.** Lo que se interpretó como "anular/cancelar desde el POS" eran en realidad confirmaciones y despachos. El mapeo correcto es el del Swagger oficial.

Esto invalida el paso de mapeo aplicado en el último turno y obliga a replantear.

## Cambios — todo en dos archivos

### Paso A — Revertir `mapWebhookStatusCode` en `src/lib/restaurantpe-normalize.ts` al mapeo oficial

```ts
case 0: return "cancelado";
case 2: return "recibido";       // confirmado por cocina
case 3: return "en_camino";      // ETA viene en tiempoEnvio
case 4: return "entregado";
```

Reescribir el bloque de comentarios: la fuente de verdad es el Swagger OAS3 del 30/07/2024 + los webhooks reales en `rp_sync_log` (sc=3 trae `tiempoEnvio:"30"`, lo que sólo tiene sentido para "en camino"). Las cancelaciones reales llegan como `sc=0` (no observadas aún en producción pero documentadas).

### Paso B — `src/routes/api/public/rp-webhook.ts`: aceptar `tiempoEnvio`, persistir ETA y enriquecer log

1. Extender el schema Zod:
  ```ts
   const Payload = z.object({
     deliveryId: z.union([z.number(), z.string()]).transform(v => String(v).trim()),
     statusCode: z.union([z.number(), z.string()]).transform(v => String(v).trim()),
     tiempoEnvio: z.union([z.number(), z.string(), z.null()]).optional()
       .transform(v => (v == null || v === "" ? null : Number(v))),
   });
  ```
2. Cuando `mapped === "en_camino"` y `tiempoEnvio` es un número finito > 0, guardar el ETA. Como `orders` no tiene columna dedicada, persistirlo dentro de `rp_response` (jsonb) con merge:
  ```ts
   updates.rp_response = { ...(row.rp_response ?? {}), eta_min: tiempoEnvio, eta_set_at: nowIso };
  ```
   Para esto el SELECT actual debe traer también `rp_response`. Es campo jsonb existente, así que no requiere migración. `TrackerOperativo` puede leerlo más adelante para mostrar "Llega en ~30 min".
3. En el log `tipo='webhook'` agregar al `payload` final el `tiempoEnvio` resuelto, y en el mensaje incluir el ETA cuando exista: `"enviado → en_camino (ETA 30 min)"`.
4. Cuando el SELECT por `rp_pedido_id` no encuentre el pedido, además del mensaje actual, listar en `payload.candidatos` los últimos 5 pedidos con `status IN ('enviado','recibido','en_preparacion','en_camino')` creados en las últimas 2 h (id, rp_pedido_id, rp_numero_comanda, created_at). Sigue respondiendo 200 (fallo suave).

### Paso C — Limpieza de pedidos contaminados por el mapeo anterior

Tres pedidos quedaron con estado equivocado por el mapeo previo: `160229→recibido`, `160214→en_camino`, `160240→entregado` (último estado correcto sólo el `entregado` de 160240). Migración corta para resetear a `enviado` los que no estén terminados realmente. Confirmamos los IDs antes de ejecutar.

## Verificación post-cambios

1. POST `sc=2` → orders.status `recibido`, log `enviado → recibido`.
2. POST `sc=3` con `tiempoEnvio:30` → orders.status `en_camino`, `rp_response.eta_min=30`, log incluye `(ETA 30 min)`.
3. POST `sc=4` → orders.status `entregado`.
4. POST `sc=0` → orders.status `cancelado`, `cancel_reason='Cancelado desde el POS'`.
5. POST con `deliveryId` inexistente → log muestra `candidatos:[...]`.

## Lo que NO toco

- Endpoint GET healthcheck, validación de token, fallo suave (todo ya funciona tras tu paso 1).
- Polling `obtenerDelivery` (sigue cubriendo `en_preparacion`).
- `TrackerOperativo`: el ETA queda guardado en `rp_response.eta_min` listo para que después lo muestres en UI; no toco la UI ahora a menos que lo pidas.
- Schema de DB (no se agrega columna `eta_minutes`; reusamos `rp_response` jsonb).

## Resumen del riesgo

El mapeo previo (2→cancelado, 3→cancelado) **debe revertirse cuanto antes**: con esa lógica, cada confirmación de cocina (`sc=2`) y cada despacho (`sc=3`) marcaría el pedido como cancelado en la app, y el cliente vería "Pedido cancelado" en `/gracias` aunque el pedido vaya en camino. Es lo opuesto a lo que se quería.

¿Aplico A + B y propongo la migración del paso C?

> **¡Excelente hallazgo! Nos acabas de salvar de un bug crítico en producción.**
>
> Tienes luz verde para aplicar este plan de emergencia, pero con estos ajustes estrictos:
>
> **1. APROBADO: Paso A (Mapeo)** Aplica el mapeo oficial del Swagger inmediatamente (`0=cancelado, 2=recibido/confirmado, 3=en_camino, 4=entregado`).
>
> **2. APROBADO: Paso B (ETA en JSONB y Logs)** Me encanta la idea de guardar el `tiempoEnvio` de forma no intrusiva dentro de `rp_response`. Aplícalo tal cual lo propones junto con la mejora en los logs (candidatos).
>
> **3. RECHAZADO: Paso C (Script de Migración)** **NO** hagas ninguna migración SQL para arreglar esos 3 pedidos. Yo entraré al Table Editor de Supabase y los corregiré manualmente. No ensuciemos el historial de migraciones por datos de prueba.
>
> **4. RECORDATORIO CRÍTICO: EL POLLING DEBE MORIR** En tu sección de "Lo que NO toco" mencionas que dejas vivo el Polling para el estado "en_preparacion". **Te reitero la orden anterior: EL POLLING DEBE SER ELIMINADO POR COMPLETO.** > Si [Restaurant.pe](http://Restaurant.pe) no envía el estado de preparación por Webhook, no importa, el cliente pasará de "Recibido" a "En Camino" directamente. No vamos a sacrificar recursos del servidor haciendo polling solo por un estado intermedio. El Webhook y Realtime son la ÚNICA fuente de verdad.
>
> **Ejecuta los Pasos A y B, y asegúrate de que no haya código de Polling corriendo. Avísame cuando esté desplegado.**