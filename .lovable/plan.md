## Causa raíz

`syncSedeMenu` (en `src/lib/rp.functions.ts`) construye filas heterogéneas para el upsert de `categorias_master` y `productos_master`:

- Filas **nuevas** incluyen `nombre` / `orden` / etc.
- Filas **existentes** solo incluyen `rp_id` (+ `updated_at`).

PostgREST agrupa esto en un único `INSERT (rp_id, nombre, orden, updated_at) VALUES ...`. Las filas "existentes" no tienen `nombre`, por lo que el VALUES lleva `NULL` en esa columna y dispara `null value in column "nombre" ... violates not-null constraint`. El mismo problema late en `productos_master` (explotará en la siguiente sync que mezcle productos nuevos y viejos).

La intención de "no pisar el nombre editado por el admin" ya está cubierta a nivel de schema mediante `nombre_override` y `descripcion_override` — el `getMenuForSede` ya hace `nombre_override ?? nombre`. Es decir: podemos refrescar siempre `nombre` desde el POS sin perder ediciones.

## Cambio

Archivo único: `src/lib/rp.functions.ts`, función `syncSedeMenu`.

### Categorías (líneas ~98–124)

Reemplazar la rama condicional por filas homogéneas:

```ts
const rows = categorias.map((c) => ({
  rp_id: c.rp_id,
  nombre: c.nombre,
  orden: c.orden,
}));
```

(Sin tocar `activo` ni `*_override` — quedan como están en la fila existente porque no los incluimos en el upsert.)

### Productos (líneas ~130–167)

Mismo principio, homogeneizar las filas:

```ts
const rows = productos.map((p) => ({
  rp_id: p.rp_id,
  categoria_id: p.rp_categoria_id != null ? catIdByRpId.get(p.rp_categoria_id) ?? null : null,
  nombre: p.nombre,
  descripcion: p.descripcion,
  precio: p.precio,
  imagen_url: p.imagen_url,
  modificadores: p.modificadores,
  modificadores_raw: p.modificadores_raw,
  almacen_id: p.almacen_id,
  orden: p.orden,
  // disponible NO se incluye: respeta el toggle manual de filas existentes
  // y deja que el default (true) aplique a filas nuevas.
}));
```

Eliminamos toda la lógica de `existing` para ambos upserts (ya no es necesaria).

### Lo que NO cambia

- `nombre_override` / `descripcion_override` siguen siendo la fuente de verdad para ediciones del admin.
- `sede_producto_overrides` y su lógica de `disponible` se mantienen igual.
- `disponible` en `productos_master` se omite del upsert para no pisar el toggle manual (las filas nuevas usan el default `true`).
- Sin cambios de schema, sin migración.

## Verificación

1. Ir a `/admin/sincronizacion` → "Sincronizar TODOS los menús".
2. Esperar `menu_all: ok` para las 14 sedes en el log.
3. Confirmar en `productos_master` que el conteo es > 0 y las imágenes están pobladas.
4. Editar `nombre_override` de una categoría/producto, re-sincronizar, verificar que el override se conserva.
