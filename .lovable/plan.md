# Plan: Sondeo aislado de `getPedidoListByDelivery`

## Objetivo
Imprimir el JSON crudo y completo que devuelve el POS para el delivery `159269`, sin tocar producción, para identificar el nombre exacto de las llaves que contienen `158720` (número de comanda) y el estado del pedido.

## Qué voy a hacer (un solo paso, read-only)

1. Verificar que `RESTAURANT_PE_TOKEN` está disponible en el sandbox (`fetch_secrets`).
2. Ejecutar un script one-shot en `/tmp/probe_rp.ts` que haga **un único GET** a:
   ```
   http://kingpapa.restaurant.pe/restaurant/api/rest/pedido/getPedidoListByDelivery/159269
   ```
   con header `Authorization: Token token="..."` y `Accept: application/json`.
3. Imprimir en el chat:
   - HTTP status + content-type
   - JSON crudo completo (con `JSON.stringify(..., null, 2)`)
   - Lista plana de llaves del primer item del array `data` (para ubicar de un vistazo dónde vive `158720` y dónde vive el estado).
4. **No** modificar `restaurantpe.server.ts`, `restaurantpe-normalize.ts` ni ningún otro archivo de producción. **No** crear migraciones. **No** tocar UI.

## Lo que NO hago en este turno
- No ajusto `extractComandaNumber` / `extractEstadoTexto` (eso es el siguiente turno, una vez vea las llaves reales).
- No arreglo el bug paralelo visible en network (`/orders?id=eq.159269` → 400 porque `id` es UUID y le estamos pasando `rp_pedido_id`). Lo dejo anotado para abordarlo justo después del sondeo, en el mismo siguiente turno, porque sin él el polling nunca va a actualizar la fila aunque el extractor funcione.

## Entregable
Un bloque en el chat con el JSON crudo + las llaves del primer item, listo para que tú confirmes los nombres y yo aplique el fix de mapeo (y el fix del `orderId` UUID vs `rp_pedido_id`) en el turno siguiente.
