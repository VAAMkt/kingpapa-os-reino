# Fix: redirección de checkout debe usar el UUID local

## Diagnóstico

El hallazgo es real. En `src/lib/orders.server.ts:459`:

```ts
return { orderId: rpPedidoId ?? localId, ... }
```

`submitOrder` devuelve el `rp_pedido_id` numérico (ej. `160364`) como `orderId` siempre que Restaurant.pe responde bien. `checkout.tsx` lo usa tal cual para redirigir → `/gracias?order_id=160364`.

`gracias.tsx` tiene un `resolveOrderId` que mitiga el problema (acepta numérico y lo traduce a UUID), por eso la página llega a cargar el resumen y el tracker. Pero deja varios efectos colaterales:

- El primer fetch directo en `TrackerOperativo` (`.eq("id", orderId)`) corre con un valor que **no es un UUID** y devuelve null hasta que `resolveOrderId` termine.
- El canal Realtime se suscribe con `id=eq.<numero>` y no recibe eventos hasta que el UUID se resuelva.
- Si RP falla y devuelve `null` como `rp_pedido_id`, la URL llevaría `undefined`/UUID inconsistente.
- El UUID es el identificador canónico para compartir/recuperar la orden.

## Cambios

### 1. `src/lib/orders.server.ts` (1 línea)

En el return final de `submitOrder`, cambiar:

```ts
orderId: rpPedidoId ?? localId,
```

por:

```ts
orderId: localId,
```

`localId`, `rpPedidoId` y los demás campos se siguen devolviendo igual, así que cualquier consumidor que necesite el id de RP lo tiene en `rpPedidoId`.

### 2. Verificar consumidores de `submitOrder().orderId`

Revisar usos para asegurar que ninguno dependa de que `orderId` sea el numérico de RP. Esperado: sólo `checkout.tsx` lo consume y lo pasa a la URL.

### 3. (Opcional) Endurecer `gracias.tsx`

No es necesario para el fix, pero `resolveOrderId` puede quedarse: sirve como red de seguridad para links viejos compartidos por WhatsApp que aún tengan el numérico.

## Lo que NO se toca

- `TrackerOperativo.tsx`: ya consume un UUID resuelto, queda correcto.
- `resolveOrderId`: se mantiene como compatibilidad hacia atrás.
- Webhook, polling POS, schema de BD, módulo de integraciones: nada cambia.
- El bug de "Asignando comanda…" es independiente (depende del polling POS extrayendo `pedido_comandaid`), no se resuelve aquí.

## Verificación

1. Hacer un pedido nuevo en producción.
2. Confirmar que la URL final es `/gracias?order_id=<uuid>`, no un numérico.
3. Confirmar que `TrackerOperativo` se conecta a Realtime inmediatamente (sin esperar al `resolveOrderId`).
4. Probar manualmente que un link viejo con `?order_id=160364` sigue funcionando (gracias a `resolveOrderId`).
