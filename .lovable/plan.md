## Diagnóstico

La sincronización funcionó: hay 151 productos únicos por sede en la base. El menú no muestra nada porque **todos los productos están guardados con `disponible = false`**, y la consulta pública filtra solo los disponibles.

Causa raíz: en `src/lib/restaurantpe-normalize.ts`, `normalizeProduct` lee `productogeneral_estado` que la API devuelve como string `"Activo"`/`"Inactivo"`, pero lo pasa por `toBool01` (que solo entiende `"1"`/`"0"`). Resultado: todo queda como `false`.

## Plan de corrección

1. **Arreglar parseo de disponibilidad** en `src/lib/restaurantpe-normalize.ts`:
   - Cuando `productogeneral_estado` sea string, considerar disponible si vale `"Activo"`, `"activo"`, `"1"` o `"true"`.
   - Mantener `producto_agotado` como señal prioritaria (si viene, manda).
   - Mantener fallback `true` cuando no haya ninguna señal.

2. **Resincronizar** los 14 sedes desde `/admin/sincronizacion`. El upsert sobrescribirá `disponible` con el valor correcto.

3. **Verificar** con una consulta directa que ahora hay productos con `disponible = true` y que `/menu` los renderiza.

No se toca diseño, UI, rutas ni esquema de base.