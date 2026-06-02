
# Cierre de hito: comanda visible, cancelación sincronizada y horario

Tres cosas a arreglar, en orden de impacto.

---

## 1) "Asignando comanda…" se queda para siempre

**Diagnóstico**
El POS muestra dos números distintos para un mismo pedido:

- `delivery_id` = `159728` → es lo que devuelve `registrarDelivery` y guardamos en `orders.rp_pedido_id`. Es la URL del POS (`/resumen/159728`).
- `pedido_numero` = `#159179` → es el número corto que el POS muestra en grande ("¡El pedido #159179 se ha realizado!").

Para obtener `pedido_numero` hoy llamamos a `rpObtenerDelivery`, que prueba 5 endpoints distintos y **todos devuelven 404 / requieren cookie de sesión del POS** (ya quedó documentado en `rp_sync_log` con `tipo=poll_pedido` antes de matar el polling). Por eso `rp_numero_comanda` jamás se rellena y la UI muestra el placeholder eternamente.

El webhook oficial **no envía** `pedido_numero` — solo `{deliveryId, statusCode}`. No hay forma fiable hoy de conseguir el corto sin la cookie del POS.

**Fix**
Dejar de prometer un número que no llega y mostrar lo que sí tenemos:

- En `src/routes/gracias.tsx`: si no hay `comanda`, mostrar `#{rpPedidoId ?? order_id}` como número principal (mismo tamaño, mismo estilo "brutalista"), con etiqueta "Ref. del POS" en vez de "Asignando comanda…". El cliente sí puede usar ese número — es lo que ve el motorizado en el POS al abrir el pedido (la URL `/resumen/{id}` usa exactamente ese ID).
- Si en algún momento el webhook o un futuro endpoint sí trae el corto, sustituirlo automáticamente (lógica Realtime ya existe).
- Quitar el bloque "ref interna" duplicado: con un solo número grande basta.
- En `src/lib/orders.server.ts`: eliminar la llamada a `rpGetPedidoListByDelivery` dentro de `submitOrder` (siempre falla y agrega ~1s de latencia al checkout). El hueco queda cubierto por el webhook + Realtime.

---

## 2) Anulación desde el POS no llega al cliente

**Diagnóstico**
Cancelaste el pedido `159728` desde el POS y `orders.status` sigue en `enviado`. En `rp_sync_log` no hay ningún registro de `tipo=webhook` para ese delivery → Restaurant.pe **no nos llamó al cancelar desde su panel** (sí lo hace cuando el cambio de estado viene desde su flujo de motorizados, pero no en cancelaciones manuales del callcenter — esto lo confirma el log vacío).

**Fix**
Como el webhook no es 100 % confiable para cancelaciones manuales del POS, agregar un **fallback polling ultra-ligero solo mientras el cliente está mirando el tracker**:

- Nuevo serverFn `pollOrderStatus({ orderId })` en `src/lib/orders.poll.functions.ts` que:
  1. Lee el `rp_pedido_id` desde nuestra DB.
  2. Llama `rpObtenerDelivery(rp_pedido_id)`.
  3. Si responde, mapea `delivery_estado` con `mapDeliveryEstado` y, si difiere del status local y no es terminal, actualiza `orders` + loguea (`tipo=poll_pedido`, `ok=true`).
  4. Si la API responde 404 (caso actual), no toca nada y devuelve `{ ok: false, reason: "api_unavailable" }` — sin spammear el log.
- En `TrackerOperativo.tsx`: si el `status` aún no es terminal, llamar a `pollOrderStatus` **cada 60 s** mientras el componente esté montado (no antes ni después). Es solo en `/gracias` y `/tracking`, no en `admin.pedidos`. Costo: ≤ 1 request/min/cliente.
- Mantener Realtime + webhook como vía primaria. El polling es red de seguridad solo para cancelaciones manuales.

Si en producción confirmamos que `obtenerDelivery` sigue devolviendo 404 también desde el worker (no solo desde dev), agregamos un botón visible "Actualizar estado" que llame al mismo serverFn — al menos el cliente tiene cómo refrescar manualmente.

---

## 3) "Estamos fuera de horario" bloquea pruebas

**Diagnóstico**
Las 7 sedes tienen `horarios = 12:00–22:00` en DB. Estás probando a las 22:05 → el bloqueo es legítimo, pero impide testing y futuras pruebas nocturnas del equipo.

**Fix — flag de bypass para staff**
Aprovechar la tabla `user_roles` que ya existe:

- En `assertSedeOperativa` (orders.server.ts): si `input.userId` corresponde a un usuario con rol `admin`, omitir la validación de horario y de `kill_switch`, y registrar en `rp_sync_log` un aviso (`tipo=order_test_mode`) para que quede traza.
- En `submitCheckoutOrder` (orders.functions.ts): ya tenemos el userId del middleware de auth; pasarlo a `submitOrder` (hoy lo pasamos como `null` cuando no hay sesión — confirmar el camino).
- Sin tocar UI: el admin simplemente loguea con su cuenta y puede pedir 24/7.

Alternativa más rápida si urge probar ahora mismo: ampliar horarios temporalmente a `00:00–23:59` vía un UPDATE puntual. Lo dejo como opción, pero el bypass por rol es la solución correcta.

---

## Archivos a tocar

- `src/routes/gracias.tsx` — cambiar el render del número grande, eliminar placeholder confuso.
- `src/lib/orders.server.ts` — quitar `rpGetPedidoListByDelivery` del checkout; respetar `userId` para bypass; bypass en `assertSedeOperativa` si rol = admin.
- `src/lib/orders.functions.ts` — pasar `userId` y rol a `submitOrder`; agregar serverFn `pollOrderStatus`.
- `src/lib/orders.poll.functions.ts` — implementar `pollOrderStatus`.
- `src/components/kp/TrackerOperativo.tsx` — auto-poll cada 60s mientras status no es terminal.

## Lo que NO voy a hacer

- No voy a forzar `rp_numero_comanda` con datos inventados.
- No voy a revivir el polling agresivo que matamos en el hito anterior — solo 1/min y solo en la vista del cliente.
- No voy a tocar `client.ts`, `types.ts`, ni `auth-middleware.ts` (auto-generados).

---

¿Doy luz verde y procedo, o prefieres alguna variante (p.ej. botón manual de refresh en vez de auto-poll, o ampliar horarios en vez del bypass por rol)?
