## Diagnóstico

El pedido actual `159666` sí quedó guardado y enviado a Restaurant.pe, pero nunca se llena `rp_numero_comanda` ni cambia el estado porque el polling está consultando endpoints que no devuelven el detalle real del pedido:

- Los endpoints `obtenerDelivery` / `obtenerEstadoDelivery` responden `404`.
- El endpoint del POS `getPedidoListByDelivery/159666` responde `200`, pero con `tipo: "401"` y `Token inválido`; el código actual lo descarta y por eso no actualiza nada.
- Además, el tracker espera 20 segundos antes del primer polling, así que aunque el endpoint funcionara, la pantalla queda en “Asignando comanda…” demasiado tiempo.

## Plan de corrección

1. **Hacer visible el fallo real del polling**
   - Ajustar `rpObtenerDelivery` para registrar en `rp_sync_log` el cuerpo/resumen del error del POS cuando responde `tipo != "1"`.
   - Así no quedará solo `lastStatus=200`; veremos si es token inválido, endpoint incorrecto o shape inesperado.

2. **Corregir la consulta de comanda/estado**
   - Revisar y adaptar `rpObtenerDelivery` para soportar el endpoint real que el POS necesita.
   - Si `getPedidoListByDelivery` requiere un token distinto al token público actual, dejar el código preparado para una variable separada tipo `RESTAURANT_PE_POS_TOKEN` y solicitarla como secreto antes de depender de ese endpoint.
   - Mantener fallback seguro: si no hay token POS, no rompe el pedido; solo deja trazabilidad clara.

3. **Actualizar inmediatamente después de crear el pedido**
   - Tras `rpRegistrarDelivery`, intentar consultar la cabecera real con el endpoint corregido y guardar `rp_numero_comanda` si viene disponible.
   - Si aún no está disponible, el tracker seguirá haciendo polling.

4. **Mejorar el tracker de `/gracias`**
   - Disparar un polling inmediato al montar `TrackerOperativo`, no esperar 20 segundos.
   - Reintentar cada 10 segundos mientras el pedido no esté en estado terminal.
   - Mostrar mejor el estado “sin comanda aún” usando la ref interna, pero sin bloquear el estado del pedido.

5. **Corregir cancelación desde admin si aplica**
   - Revisar si el cambio de estado en `/admin/pedidos` está fallando por permisos/RLS o por no estar autenticado como editor.
   - Si el update directo desde cliente falla, reemplazarlo por una server function protegida para editores/super_admin que actualice `status`, `cancel_reason` y `cancelled_at` de forma confiable.
   - El cliente en `/gracias` seguirá recibiendo el cambio por Realtime o por recarga/polling.

## Validación

- Verificar en base de datos que el pedido `159666` reciba `rp_numero_comanda` o que quede un error explícito de credencial/endoint en `rp_sync_log`.
- Probar cancelar un pedido desde admin y confirmar que `/gracias` cambia a “Pedido cancelado” con motivo.
- Confirmar que el tracker ya no queda silenciosamente congelado en “Asignando comanda…”, sino que consulta de inmediato y deja logs útiles si Restaurant.pe no entrega datos.