## Objetivo

Filtrar la sincronización Restaurant.pe para guardar SOLO el catálogo digital (delivery/quipupos), extraer imágenes y descripciones reales, y darte una pantalla `/admin/menu` para organizar el orden y la visibilidad de categorías/productos.

## Paso 1 — Filtro de delivery + parámetro quipupos

**`src/lib/restaurantpe.server.ts`**
- Cambiar la URL de `obtenerCartaPorLocal` de `?quipupos=0` a `?quipupos=1` para que el POS pre-filtre.

**`src/lib/restaurantpe-normalize.ts`**
- Extender `RpCategoria` y `RpProducto` (en `src/types/restaurantpe.ts`) con `categoria_delivery`, `categoria_estado`, `producto_delivery`, `productogeneral_estado`, `lista_presentacion`, `producto_urlimagen`, `producto_precio`.
- `normalizeCategoria`: marcar `activo = (categoria_delivery === "1") || (categoria_estado === "1")` y propagarlo.
- `normalizeProduct`:
  - Si hay `lista_presentacion`, elegir la primera presentación con `producto_delivery === "1"`. Si ninguna lo tiene, devolver `null` (producto se descarta).
  - Tomar `precio` de esa presentación (`producto_precio`); fallback a `productogeneral_preciofijo`.
  - Imagen: prioridad `presentacion.producto_urlimagen` → `productogeneral_urlimagen` → `producto_imagen`. Guardar la ruta tal cual viene (relativa o absoluta), sin concatenar dominio (decisión CEO).
  - Descripción larga: `productogeneral_descripcionweb` → `productogeneral_descripcion` → `producto_descripcion_larga`.

**`src/lib/rp.functions.ts` (`extractMenu` / `syncSedeMenu`)**
- Filtrar categorías por `activo === true` antes de upsert.
- Filtrar productos `null` (sin presentación delivery).
- Filtrar productos cuya `rp_categoria_id` no esté en las categorías activas.

## Paso 2 — Campo `orden` editable

Las tablas `rp_categorias` y `rp_productos` ya tienen columna `orden int default 0`. No hace falta migración de esquema.

**`src/lib/rp.functions.ts`**
- En el upsert, NO sobrescribir `orden` si la fila ya existe (para no pisar el orden manual del admin). Solución: omitir `orden` del objeto upserteado y, en una segunda query, hacer `update orden = X` solo donde `orden = 0`. Alternativa más simple: usar `ignoreDuplicates: false` pero quitar `orden` del payload — al ser PostgREST upsert, sí sobrescribe; mejor hacer dos pasos:
  1. Upsert sin `orden`.
  2. `update rp_categorias set orden = $rpOrden where sede_id=? and rp_id=? and orden = 0`.
- Para productos: en el primer insert dejar `orden = 0`; el admin lo sube.

## Paso 3 — Pantalla `/admin/menu`

**Nuevo server fn en `src/lib/rp.functions.ts`:**
- `listAdminMenu({ sedeId })`: devuelve categorías (con `activo`, `orden`) y productos (`disponible`, `orden`, categoría, precio, imagen).
- `updateCategoria({ id, orden?, activo? })` y `updateProducto({ id, orden?, disponible? })`. Ambos protegidos con `requireSupabaseAuth` (RLS ya restringe a editor/super_admin).

**Nueva ruta `src/routes/admin.menu.tsx`:**
- Selector de sede (reusa `listAllSedes`).
- Tabla de categorías: nombre, input numérico `orden`, switch `activo`, botón guardar (mutation por fila o debounce).
- Tabla de productos agrupados por categoría (ordenados por `orden`): thumbnail con `imagen_url`, nombre, precio, input `orden`, switch `disponible`.
- Optimistic update con React Query + `toast`.
- Estilo brutalist con `BrutalCard`, `BrutalButton`, componentes shadcn `Input`/`Switch`/`Table` ya presentes.

**Link en el admin** (`src/routes/admin.index.tsx` o el sidebar): añadir entrada "Menú" → `/admin/menu`.

## Paso 4 — Resync y verificación

1. Migración no requerida (orden ya existe).
2. Tras desplegar, ir a `/admin/sincronizacion` → "Sincronizar TODOS los menús".
3. Verificar con SQL que `rp_categorias.activo` y `rp_productos.imagen_url` traen valores reales, y que `count(*) where disponible=true` se redujo respecto al sync anterior (filtro delivery aplicado).
4. Abrir `/admin/menu`, cambiar orden de "Combos" a 1, verificar que `/menu` público respeta el orden.

## Nota sobre imágenes rotas

Como advertiste, las rutas pueden venir relativas. El plan guarda el string tal cual. Si en `/admin/menu` las imágenes salen rotas, en una iteración siguiente añadimos un helper `resolveRpImage(url)` que concatene `https://api.restaurant.pe/archivos/` cuando la ruta no empiece por `http`. No lo aplicamos ahora para no romper imágenes que ya vengan absolutas.

## Fuera de alcance

- No se toca el diseño visual del `/menu` público.
- No se toca auth, sedes, ni el flujo de checkout.
- No se modifica el esquema (orden ya existe; activo ya existe en categorías; disponible ya existe en productos).
