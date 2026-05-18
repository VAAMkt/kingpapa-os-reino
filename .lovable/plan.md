## Diagnóstico

Hice una verificación directa de la base de datos:

- **Sedes:** 14 vinculadas correctamente con su `rp_local_id` (solo Mallplaza NQS sin mapear). ✅
- **Categorías Restaurant.pe:** **0**
- **Productos Restaurant.pe:** **0**
- **Log de sincronización:** solo hay un evento `branches`. No hay ningún `menu`.

**Causa:** en `/admin/sincronizacion` solo se ejecutó "Sincronizar sedes". El botón **"Sync menú"** por sede nunca se accionó, por eso `rp_productos` y `rp_categorias` están vacíos y el menú sigue mostrando los mocks de `src/data/productos.ts`.

Además, la home (`/`) hoy importa **todo hardcodeado** (`@/data/productos` y `@/data/historias`), mientras que `/historias` y `/admin/contenidos` sí están conectados a la tabla real `posts`. Por eso ves desfase entre el blog y la sección "Retos, festivales y locuras" de la home.

## Plan

### 1. Sincronización masiva en un click
- Botón **"Sincronizar TODOS los menús"** en `/admin/sincronizacion` que recorre todas las sedes con `rp_local_id` y llama `syncMenuForSede` secuencialmente, mostrando progreso (`3/14 …`) y resumen final.
- También un botón **"Sincronizar todo ahora"** que primero llama `syncBranches` y luego sincroniza todos los menús.

### 2. Capa de adaptación productos
Nuevo helper `src/lib/menu.ts` que mapea `rp_productos` → tipo `Producto` que usa `ProductCard`:
- `nombre`, `descripcion`, `imagen` (con fallback a placeholder si `imagen_url` es null), `precioDesde = precio`.
- Defaults razonables para campos que Restaurant.pe no expone: `nivelHambre=3`, `nivelPicante=0`, `pesoAprox=""`, `ocasiones=[]`, `paraCompartir=false`.
- `categorias = [categoria.nombre slugified]`.
- Categorías derivadas en runtime desde `rp_categorias` (ya no se usan las 10 hardcodeadas de `data/productos.ts`).

### 3. Conectar `/menu` a datos reales
- Reemplazar import de `@/data/productos` por `useQuery(["menu", sedeSlug], () => getMenuForSede({ data: { sedeSlug } }))`.
- Selección de sede: usa `?sede=slug` (ya existe en `validateSearch`); si no, primera sede publicada con menú sincronizado.
- Selector visible de sede arriba del filtro (las sedes pueden tener menús distintos).
- Estados: loading (skeleton), vacío ("Esta sede aún no tiene menú sincronizado, ve a /admin/sincronizacion"), error.
- Filtros = categorías reales de esa sede (no las 10 fijas).
- Se eliminan las importaciones de imágenes locales en `data/productos.ts` (queda obsoleto pero se conserva el archivo por ahora, solo se deja de importar desde la app).

### 4. Conectar la home `/` a datos reales
- **Productos estrella:** `useQuery` al mismo `getMenuForSede` (primera sede publicada) y tomar los primeros 4 productos `disponible=true`. Si no hay menú aún, ocultar la sección o mostrar CTA "Pronto en línea".
- **Retos / festivales:** reemplazar `historias` de `@/data/historias` por `useQuery(["posts","public"], listPublicPosts)` y filtrar `categoria in ['Retos','Festivales']`. Esto hace que los cambios hechos en `/admin/contenidos` se reflejen aquí (y resuelve el problema de imágenes desfasadas que reportaste).

### 5. Limpieza
- `src/data/productos.ts` y `src/data/historias.ts` quedan **deprecated** (no se borran porque `admin.index.tsx` y `dashboard.tsx` los referencian solo para conteos; eso se migra a `count()` real sobre las tablas en un commit posterior dentro de "tracker operativo").
- Marcar el archivo con un comentario `@deprecated` arriba.

## Detalles técnicos

```text
src/lib/menu.ts                      (nuevo)  rpProductoToProducto, getCategoriasFromMenu
src/lib/rp.functions.ts              (edit)   añade syncAllMenus serverFn opcional (loop server-side)
src/routes/admin.sincronizacion.tsx  (edit)   botón "Sync todos los menús"
src/routes/menu.tsx                  (edit)   useQuery getMenuForSede + selector de sede
src/routes/index.tsx                 (edit)   useQuery posts + useQuery menú sede default
src/components/kp/Cards.tsx          (sin cambios — EventCard ya acepta Historia mapeada desde posts)
```

## Fuera de alcance (siguiente commit)
- Carrito, checkout, tracker en vivo, lealtad (commits 4–8 del plan original). Una vez confirmes que el menú y la home muestran datos reales, sigo con esos.

## Acción que necesito de ti después de aprobar
Ninguna manual — el botón nuevo "Sync todos los menús" hará el trabajo de los 14 clicks por ti.