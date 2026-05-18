# Plan: Corregir integración Restaurant.pe (OAS3)

## Diagnóstico

La API migró a OAS3 con dos cambios que rompen la sincronización actual:

1. **Rutas nuevas** (mismo host `api.restaurant.pe/restaurant`):
   - Lectura: prefijo `/readonly/rest/delivery/...`
   - Escritura: prefijo `/public/v2/rest/delivery/...`
   - Hoy todo el cliente usa `BASE_URL = http://api.restaurant.pe/restaurant/public/v2/rest`, así que los GET de catálogo y dominio están pegándole a un prefijo equivocado.

2. **Respuesta del catálogo anidada**:
   - Categorías: `envelope.data.listaCategorias`
   - Productos: `envelope.data.data` (array `data` dentro del objeto `data`)
   - Hoy `rpFetch` retorna `json.data` y el llamador lee `menu.categorias` / `menu.productos` → siempre vacío.

Los cambios se aíslan a 3 archivos de lógica. **No se tocan componentes, Tailwind, ni `src/components/**`.**

## Cambios por archivo

### 1. `src/types/restaurantpe.ts`
- Reescribir `RpMenuData` para reflejar OAS3:
  ```ts
  export type RpMenuData = {
    tipo?: string;
    data?: RpProducto[];            // array de productos
    listaCategorias?: RpCategoria[]; // array de categorías
    totalregistros?: number;
  };
  ```
- Ampliar `RpProducto` con los campos OAS3 que usaremos en el mapper:
  `productogeneral_id`, `productogeneral_descripcion`, `productogeneral_preciofijo`,
  `categoria_id`, `lista_presentacion?`, `listaModificadores?`,
  `lista_productobase?`, `lista_productoadicional?`. Mantener los campos legacy
  como opcionales para no romper otros consumidores.
- `RpCategoria`: asegurar `categoria_id` y `categoria_descripcion` (ya están).
  `categoria_orden` queda opcional.

### 2. `src/lib/restaurantpe.server.ts`
- Separar la base por tipo de operación:
  ```ts
  const HOST = "http://api.restaurant.pe/restaurant";
  const READ_BASE  = `${HOST}/readonly/rest`;
  const WRITE_BASE = `${HOST}/public/v2/rest`;
  ```
- `rpFetch<T>(path, { base: "read" | "write", ... })` elige el prefijo.
- `rpGetDominioInfo` → `READ_BASE` + `/delivery/obtenerInformacionDominio/{dominio}?quipupos=0`.
- `rpGetCatalogo(localId)` → `READ_BASE` + `/delivery/obtenerCartaPorLocal/{dominio}/{local}?quipupos=0`.
- `rpGetStock` (POST) → `WRITE_BASE` + `/delivery/getStockProducto/{dominio}?quipupos=0`.
- Dejar preparado un helper `rpRegistrarDelivery` (POST `WRITE_BASE` + `/delivery/registrarDelivery/{dominio}`) aunque aún no se use desde el front (lo necesitaremos en commits siguientes de checkout). No se llama desde ningún sitio todavía, solo se exporta.

### 3. `src/lib/restaurantpe-normalize.ts`
Ajustar `normalizeProduct` y `normalizeCategoria` para tolerar el nuevo schema:

- `normalizeProduct`:
  - `rp_id` ← `producto_id ?? productogeneral_id`
  - `nombre` ← `producto_descripcion ?? productogeneral_descripcion`
  - `precio` ← `producto_precio ?? productogeneral_preciofijo`
  - `descripcion` ← `producto_descripcion_larga ?? null`
  - `rp_categoria_id` ← `categoria_id`
  - `modificadores` ← `modificadores ?? listaModificadores`
  - `imagen_url`, `disponible`, `almacen_id` se mantienen (opcionales en OAS3, default seguro).
- `normalizeCategoria`: sin cambios funcionales, pero `categoria_orden` por defecto `0` si viene `undefined`.

### 4. `src/lib/rp.functions.ts`
Corregir la extracción en `syncMenuForSede` y `syncAllMenus`:

```ts
const menu = await rpGetCatalogo(sede.rp_local_id);
const categorias = (menu.listaCategorias ?? []).map(normalizeCategoria);
const productos  = (menu.data ?? []).map(normalizeProduct);
```

Resto de la lógica de upsert a `rp_categorias` / `rp_productos` y el log se mantienen.

## Verificación

1. `bun add` no hace falta (no se agregan deps).
2. Ir a `/admin/sincronizacion` → "Sincronizar TODOS los menús".
   - Esperado: respuesta OK con `categorias > 0` y `productos > 0`.
   - Si una sede falla, el resto continúa (error per-sede ya está implementado).
3. Consulta rápida a Supabase (`rp_categorias`, `rp_productos`) para confirmar filas reales.
4. `/menu` y home (`Retos, festivales y locuras`) muestran datos reales en lugar de hardcodeo.

## Fuera de alcance (no se toca)

- Cualquier archivo en `src/components/**` (UI/Tailwind intactos).
- Lógica de checkout / carrito / tracker / lealtad (commits 3–8 siguientes).
- `src/integrations/supabase/*` (auto-generado).

¿Apruebas para implementar?
