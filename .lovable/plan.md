
## Objetivo

Que la sincronización de Restaurant.pe deje un menú **limpio, ordenado y con fotos** desde el segundo cero, y que `/admin/menu` permita reordenar con flechas/drag-and-drop en lugar de digitar números.

---

## Paso 1 — Normalizador más estricto (`src/lib/restaurantpe-normalize.ts`)

**Categorías** (`normalizeCategoria`):
- Ya no asumimos "activo" cuando faltan flags. Exigimos:
  `activo = categoria_estado === "1" && categoria_delivery === "1"`.
- Si alguna sede no manda esos campos, sus categorías quedan inactivas (visibles en admin como "Activa = OFF" para que el editor las prenda manualmente). Esto es lo que el usuario pidió: limpieza extrema.

**Productos** (`normalizeProduct`):
- Mantener filtro de `producto_delivery === "1"` en `lista_presentacion`.
- **Extracción de precio mejorada** (combos vs simples):
  ```
  precio = productogeneral_precio
        ?? presentacionActiva.producto_precio
        ?? productogeneral_preciofijo
        ?? 0
  ```
  Si `precio === 0` → retornar `null` (descartar producto).
- **Imágenes absolutas**: nuevo helper `resolveRpImage(url)`:
  - Si `url` está vacía → `null`.
  - Si empieza con `http://` / `https://` → tal cual.
  - Si no → `https://api.restaurant.pe/archivos/${url}` (sin doble slash).
  Aplicar a `producto_urlimagen` y `productogeneral_urlimagen`.

**Orden nativo**:
- `normalizeCategoria` y `normalizeProduct` reciben un `index` opcional y devuelven `orden = index` cuando no venga uno explícito del POS. El `.map()` en `extractMenu` pasa el índice.

## Paso 2 — Heredar orden en sync (`src/lib/rp.functions.ts`)

En `syncSedeMenu`:
- **Categorías**: el upsert ahora sí incluye `orden: c.orden` para filas **nuevas**. Para preservar overrides del admin, hacemos:
  1. Leer `rp_categorias` existentes (`rp_id, orden`).
  2. Solo incluir `orden` en el payload para `rp_id` que **no existen** todavía.
  3. Mismo patrón para `rp_productos`.
- Así: primera sync hereda orden de RP; sync siguientes respetan el orden manual.
- Filtros adicionales: descartar productos sin `categoria_id` válido y con `precio === 0` (defensa en profundidad).

## Paso 3 — UX en `/admin/menu` (`src/routes/admin.menu.tsx`)

Reemplazar el input numérico por una experiencia más rápida:

1. **Botones ▲ ▼** en cada fila (categorías y productos). Al click:
   - Calcular el `orden` swap con el vecino y disparar dos mutaciones (mutación batch en un nuevo serverFn `reorderItems`).
2. **Drag-and-drop con `@dnd-kit/core` + `@dnd-kit/sortable`** sobre la lista de categorías y dentro de cada grupo de productos. Al soltar, recalcular `orden = índice * 10` y enviar batch.
   - Nuevo serverFn: `reorderAdminCategorias({ updates: [{id, orden}, ...] })` y `reorderAdminProductos(...)`.
3. **Toggle "Ocultar inactivos"** (estado local). Cuando está ON:
   - Filtra categorías con `activo === false`.
   - Filtra productos con `disponible === false`.
4. **Thumbnails + precio reales** ya están renderizados; sólo asegurar que `imagen_url` ya viene absoluta desde Paso 1 (no se rompe `<img>`).
5. Mantener el switch de activar/desactivar y el diseño Neubrutalista (BrutalCard, bordes, sombras). No tocamos el sistema de design tokens.

## Paso 4 — Dependencias e instalación

- `bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`.

## Paso 5 — Verificación

1. Reiniciar /admin/sincronizacion → "Sincronizar TODOS los menús".
2. Verificar en `/admin/menu`:
   - Categorías ordenadas igual que el POS.
   - Productos con thumbnail visible (URL `https://api.restaurant.pe/archivos/...`).
   - Combos con precio > 0.
   - Toggle "Ocultar inactivos" funciona.
   - Drag-and-drop persiste orden tras refrescar.
3. Verificar `/menu` público sigue mostrando lo mismo (no cambia el contrato).

## Fuera de alcance

- Cambios en el público `/menu` más allá de lo que herede del orden y las imágenes.
- Editar precios desde admin (sigue siendo source-of-truth POS).
- Auth, checkout, modificadores, stock.

## Detalles técnicos (sólo para devs)

```text
restaurantpe-normalize.ts
├── resolveRpImage(url): string|null
├── normalizeCategoria(raw, index?)
│   activo = est==="1" && deliv==="1"
│   orden  = raw.categoria_orden ?? index ?? 0
└── normalizeProduct(raw, index?)
    precio = generalPrecio ?? presPrecio ?? generalFijo ?? 0
    if (precio === 0) return null
    imagen = resolveRpImage(...)
    orden  = index ?? 0

rp.functions.ts / syncSedeMenu
├── leer rp_categorias existentes (rp_id, orden)
├── upsert cats: incluir `orden` SOLO si rp_id es nuevo
├── leer rp_productos existentes
└── upsert prods: incluir `orden` SOLO si rp_id es nuevo

admin.menu.tsx
├── @dnd-kit Sortable para cats y prods-por-cat
├── botones ▲▼ como fallback accesible
├── toggle "Ocultar inactivos" (useState)
└── nuevos serverFn: reorderAdminCategorias, reorderAdminProductos
    (validan con z.array({id,orden}).max(500), update batch)
```
