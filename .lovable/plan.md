## Diagnóstico

La API real sí está devolviendo menú. Probé directamente `obtenerCartaPorLocal` con las credenciales del entorno y devuelve `130` productos para el local `1`.

El problema exacto es este: `rpFetch` siempre retorna solo `json.data`, pero en la respuesta real de Restaurant.pe:

- `data` es el array de productos directamente.
- `listaCategorias` viene en la raíz del JSON, al mismo nivel que `data`.

Entonces el código actual recibe solo el array de productos y pierde `listaCategorias`. Luego `syncAllMenus` intenta leer `menu.listaCategorias` y `menu.data`, pero `menu` en realidad es un array, por eso ambos quedan vacíos.

## Plan de cambios

1. **Corregir `rpGetCatalogo` sin tocar UI**
   - Ajustar `src/lib/restaurantpe.server.ts` para que el fetch del catálogo retorne el payload completo del envelope, no solamente `json.data`.
   - Mantener las rutas correctas:
     - lectura: `/readonly/rest/delivery/obtenerCartaPorLocal/{dominio}/{local}?quipupos=0`
     - escritura: `/public/v2/rest/delivery/registrarDelivery/{dominio}`

2. **Hacer robusta la extracción del menú**
   - Ajustar `syncMenuForSede` y `syncAllMenus` en `src/lib/rp.functions.ts` para soportar ambas formas reales:
     - productos como `menu.data` cuando viene objeto completo
     - productos como `menu` cuando viene array directo
   - Leer categorías desde `menu.listaCategorias`.
   - Si no hay categorías pero los productos traen `categoria_id` y `categoria_descripcion`, crear categorías derivadas desde los productos como fallback realista.

3. **Actualizar tipos para reflejar la respuesta real**
   - Ajustar `src/types/restaurantpe.ts` para documentar que `listaCategorias` está en la raíz del envelope y que `data` puede ser el array de productos.
   - Añadir campos reales vistos en producción como `productogeneral_urlimagen`, `productogeneral_descripcionweb`, `categoria_descripcion`.

4. **Mejorar normalización de productos**
   - En `src/lib/restaurantpe-normalize.ts`, mapear:
     - imagen desde `productogeneral_urlimagen`
     - descripción larga desde `productogeneral_descripcionweb`
     - disponibilidad desde `productogeneral_estado` cuando exista
   - Mantener compatibilidad con los campos legacy actuales.

5. **Validación posterior**
   - No meter una trampa que rompa el flujo al usuario.
   - Dejar el resultado listo para que al presionar “Sincronizar TODOS los menús” devuelva conteos reales mayores a 0 y guarde productos/categorías.

## Archivos a tocar

- `src/lib/restaurantpe.server.ts`
- `src/lib/rp.functions.ts`
- `src/lib/restaurantpe-normalize.ts`
- `src/types/restaurantpe.ts`

No tocaré componentes visuales ni clases de UI.