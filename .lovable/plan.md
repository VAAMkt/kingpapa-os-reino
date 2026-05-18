## Diagnóstico

El timeout viene de la cantidad de llamadas a la base, no de la API de Restaurant.pe. Para 14 sedes el código actual hace:

- 14 fetch HTTP a Restaurant.pe (rápido, ~1s c/u).
- ~26 upserts secuenciales de categorías por sede × 14 = ~360 round-trips.
- ~130 upserts secuenciales de productos por sede × 14 = ~1.820 round-trips.

Más de 2.000 idas y vueltas a Postgres dentro de una sola server function. Excede el límite de ejecución del worker y por eso la respuesta nunca llega.

## Plan de cambios

1. **Upserts en lote (la cura real)**
   - En `src/lib/rp.functions.ts`, dentro de `syncAllMenus` y `syncMenuForSede`:
     - Reemplazar el loop de categorías por **un solo `.upsert(arrayCategorias, { onConflict: "sede_id,rp_id" }).select("id, rp_id")`** que regrese el mapa `rp_id → id` en una sola llamada.
     - Reemplazar el loop de productos por **un solo `.upsert(arrayProductos, { onConflict: "sede_id,rp_id" })`** por sede.
   - Resultado: ~3 llamadas a la base por sede en vez de ~156.

2. **Paralelizar sedes con concurrencia controlada**
   - Procesar las 14 sedes con un pool de concurrencia (p. ej. 4 sedes en simultáneo) usando `Promise.allSettled` por lotes.
   - Eliminar la pausa de 150 ms entre sedes (ya no satura porque cada sede pesa mucho menos).

3. **Acortar el fetch a Restaurant.pe**
   - Bajar el timeout por request de 15 s a 10 s para que una sede atascada no bloquee el lote.
   - Mantener un reintento.

4. **Robustez sin tocar UI**
   - Si una sede falla, capturarla en `errores[]` y seguir con el resto (ya está, se conserva).
   - Conservar el barrido de "marcar no disponibles" como UNA sola query por sede (ya lo es).
   - Conservar el log `rp_sync_log` final.

5. **Validación**
   - El usuario presiona “Sincronizar TODOS los menús” y debe completar en pocos segundos con conteos reales > 0.
   - Verificar después con consulta a `rp_categorias` y `rp_productos` que hay filas.

## Archivos a tocar

- `src/lib/rp.functions.ts` (única edición funcional)
- `src/lib/restaurantpe.server.ts` (solo bajar `TIMEOUT_MS`)

Sin cambios en componentes, rutas ni estilos.