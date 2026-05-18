# Fase 4 — Persistencia, Imágenes reales y Menu Engineering

## 1. Persistencia total al re-sincronizar

Hoy el upsert ya respeta `orden` y `activo`/`disponible` para filas existentes, pero **sí sobrescribe** el `nombre` de categorías y productos. Si tú renombraste "ADICIONES" → "EXTRAS", la próxima sync lo borra.

**Cambio quirúrgico en `syncSedeMenu`** (`src/lib/rp.functions.ts`):

- Categorías existentes: NO mandar `nombre` en el upsert (solo updatear `updated_at`). Para crear filas nuevas sí se manda.
- Productos existentes: NO mandar `nombre` ni `descripcion` (campos editables por admin). Sí seguir refrescando `precio`, `imagen_url`, `modificadores`, `almacen_id` — porque eso viene del POS y debe actualizarse.
- Agregar columnas `nombre_override` y `descripcion_override` en `productos_master` y `categorias_master` para que el admin pueda renombrar sin perder el original del POS (futuro toggle "Usar nombre del POS").

Resultado: cualquier toggle (oculto/visible), reorden, o rename hecho en `/admin/menu` sobrevive todas las syncs futuras.

## 2. Imágenes correctas (extraer del producto real, no del padre)

Diagnóstico mirando `normalizeProduct` + el OAS3: hoy priorizamos `productogeneral_urlimagen` (la foto del **combo padre**) sobre `lista_presentacion[0].producto_urlimagen` (la foto de la **variante real** que se vende). Por eso TODAS las adiciones se ven con la misma foto del combo padre — están heredando la imagen del nodo general en vez de la propia.

**Cambios en `src/lib/restaurantpe-normalize.ts`:**

- Para productos NORMALES (no combo): leer imagen así, en orden:
  1. `lista_presentacion[0].producto_urlimagen` (la real)
  2. `producto_imagen`
  3. `productogeneral_urlimagen` (último recurso)
- Para COMBOS: mantener `productogeneral_urlimagen` (es la del combo armado).
- Agregar logging de cuántos productos quedaron sin imagen tras la normalización.

**Quitar "picante" y "hambre" del ProductCard** (no aplica al negocio):
- Borrar componentes `Chili` y `HambreBar`, y la línea "Perfecta pa'…".
- Reemplazar con: precio grande + descripción + badges de menu engineering (ver punto 3).

## 3. Menu Engineering en `/admin/menu`

Agregar columnas a `productos_master` y exponerlas en el admin:

| Columna | Tipo | Uso UI |
|---|---|---|
| `destacado` | bool | Card grande en el grid (col-span-2) |
| `es_nuevo` | bool | Badge "NUEVO" verde |
| `es_mas_vendido` | bool | Badge "MÁS VENDIDO" rojo |
| `es_recomendado` | bool | Badge "🔥 RECOMENDADO" |
| `clasificacion_me` | enum: `star`, `plowhorse`, `puzzle`, `dog` | Indicador interno para el admin (no se ve al cliente) — clásico Kasavana & Smith |
| `margen_pct` | numeric nullable | Para que el admin marque margen y la matriz ME se autoclasifique |
| `etiqueta_custom` | text nullable | Badge libre tipo "EDICIÓN LIMITADA" |

**UI nueva en `/admin/menu`** (cada fila de producto):
- Switches actuales (visible) + nuevos toggles compactos: ⭐ Destacado · 🆕 Nuevo · 🔥 Top
- Selector ME: Estrella / Caballo / Puzzle / Perro (con tooltip explicando la matriz)
- Input opcional de margen %
- Vista "Matriz ME": tab nueva que pinta los 4 cuadrantes con tus productos arrastrados según popularidad (de pedidos reales si hay, manual si no) vs margen.

**UI nueva en `/menu` (cliente):**
- Productos `destacado=true` ocupan card 2x grande arriba del grid de su categoría.
- Badges visibles según flags.
- Sección "Las coronas del Rey" al inicio del menú: top 4 estrellas + más vendidos.

## Plan técnico de archivos

1. **Migration nueva** — `phase4_menu_engineering.sql`:
   - ALTER `categorias_master` ADD `nombre_override`, `descripcion_override`.
   - ALTER `productos_master` ADD las 7 columnas de ME.
2. **`src/lib/restaurantpe-normalize.ts`** — reescribir extracción de imagen para normales vs combos.
3. **`src/lib/rp.functions.ts`** — `syncSedeMenu`: dejar de pisar `nombre`/`descripcion` en filas existentes. Nuevos serverFn: `updateProductoMenuEngineering`, `listMenuEngineeringMatrix`.
4. **`src/routes/admin.menu.tsx`** — añadir controles ME por fila + tab matriz.
5. **`src/components/kp/ProductCard.tsx`** — quitar picante/hambre, agregar badges y soporte `destacado` (variante card grande).
6. **`src/routes/menu.tsx`** — sección "Coronas del Rey" arriba + grid con `col-span-2` para destacados.
7. **`src/lib/menu.ts`** — pasar los nuevos campos del row al tipo `Producto`.

## Lo que NO toco

- Lógica de gate de ubicación, checkout, sedes.
- Token de Restaurant.pe (ya resuelto).
- Tablas de sedes / overrides (los overrides per-sede siguen igual; la ingeniería de menú es global como dijimos en Fase 3).

¿Le doy?
