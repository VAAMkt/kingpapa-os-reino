## Corregir endpoint catálogo Restaurant.pe

El path correcto es `/delivery/obtenerCartaPorLocal/{dominio_id}/{local_id}` (es **por local**, no por dominio). Esto cambia la lógica: el menú ya no se trae "una vez" por dominio, sino una vez por cada sede.

### Cambios

**`src/lib/restaurantpe.server.ts`**
- `RP_CATALOGO_PATH` = `/delivery/obtenerCartaPorLocal/{dominio}/{local}?quipupos=0`.
- `rpGetCatalogo(localId)` pasa a requerir `localId` (obligatorio); valida que venga.

**`src/lib/rp.functions.ts`**
- `syncMenuForSede`: pasar `rp_local_id` a `rpGetCatalogo(sede.rp_local_id)`.
- `syncAllMenus`: mover `rpGetCatalogo` dentro del bucle por sede, llamándolo con `sede.rp_local_id`. Mantener el manejo de errores por sede para que si una falla no tumbe el resto. Agregar pequeño `await sleep(150)` entre sedes para no saturar la API.

### Verificación

1. `/admin/sincronizacion` → "Sincronizar TODOS los menús" debería responder OK con conteo de categorías/productos por sede.
2. `/menu` y home deberían mostrar datos reales una vez sincronizadas las sedes con `rp_local_id`.
