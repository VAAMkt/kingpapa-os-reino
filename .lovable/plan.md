## Diagnóstico

La sincronización ya está leyendo el menú, pero falla en el `upsert` masivo porque Restaurant.pe devuelve productos con IDs colisionados dentro de la misma sede. Ejemplo real de la API: en Granada, el ID `304` aparece dos veces, una como `productogeneral_id=304` y otra como `producto_id=304` con `productogeneral_id=274`. Postgres no permite que un mismo `INSERT ... ON CONFLICT DO UPDATE` intente actualizar la misma fila dos veces en una sola operación.

## Plan de corrección

1. **Cambiar la normalización del ID del producto**
   - En `src/lib/restaurantpe-normalize.ts`, priorizar `productogeneral_id` sobre `producto_id` para `rp_id`.
   - Confirmado contra la API: usando `productogeneral_id` no hay duplicados en las 15 sedes consultadas.
   - Esto mantiene compatibilidad usando `producto_id` solo como fallback si no existe `productogeneral_id`.

2. **Blindar el batch antes del upsert**
   - En `src/lib/rp.functions.ts`, deduplicar categorías por `rp_id` antes del upsert de `rp_categorias`.
   - Deduplicar productos por `rp_id` antes del upsert de `rp_productos`, para que aunque la API vuelva a mandar datos raros, nunca llegue un batch con claves repetidas.
   - Usar el array deduplicado también para `incomingIds` y para los conteos devueltos.

3. **Mantener el diseño y la UI intactos**
   - No tocar componentes visuales ni clases de UI.
   - No cambiar rutas externas: lectura sigue por `/readonly/rest` y escritura/stock sigue por `/public/v2/rest`.

4. **Validación posterior**
   - Hacer una verificación directa de la API externa para confirmar que la estrategia de ID ya no produce duplicados.
   - El usuario podrá volver a correr “Sincronizar TODOS los menús” y el resultado esperado será sin el error `ON CONFLICT DO UPDATE command cannot affect row a second time`.