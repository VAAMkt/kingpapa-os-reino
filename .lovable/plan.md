# Plan: Catálogo Maestro Global + Flujo "Craving First"

Ejecuto en 3 fases para minimizar riesgo. Fases 1 y 2 las puedes mergear hoy. Fase 3 toca BD y la dejo para confirmar contigo antes de migrar.

---

## FASE 1 — Motor de datos real (normalizador quirúrgico)

**Archivo:** `src/lib/restaurantpe-normalize.ts`

Reescribir `normalizeProduct` con la lógica condicional `escombo`:

```ts
const esCombo = String(r["productogeneral_escombo"] ?? "0") === "1";

// Precio
const presentaciones = Array.isArray(raw.lista_presentacion) ? raw.lista_presentacion : [];
const precio = esCombo
  ? toNum(r["productogeneral_precio"] ?? r["productogeneral_preciofijo"])
  : toNum(presentaciones[0]?.["producto_precio"]);

// Imagen
const imgRel =
  (r["productogeneral_urlimagen"] as string | undefined) ??
  (presentaciones[0]?.["producto_urlimagen"] as string | undefined);
const imagen = resolveRpImage(imgRel);

// Delivery activo
const activoDelivery = esCombo
  ? true
  : presentaciones.some((p) => String(p["producto_delivery"] ?? "0") === "1");

if (precio <= 0 || !activoDelivery) return null;
```

Mantener el resto de campos. Añadir a la fila guardada un campo `modificadores_raw` con `{ listaModificadores, lista_productobase, lista_productoadicional }` para upselling futuro — requiere columna `modificadores_raw jsonb` en `rp_productos` (default `'{}'::jsonb`). Migración pequeña incluida.

**Verificación:** correr `syncMenuForSede` con una sede real y confirmar que aparecen combos (precio > 0) y desaparecen insumos.

---

## FASE 2 — Flujo "Craving First" (UX sin bloqueo)

### 2.1 — Quitar auto-open del LocationGate
`src/components/kp/LocationGate.tsx`: eliminar el `useEffect` que hace `setOpen(true)` cuando no hay sede activa. El gate **solo** abre vía `openLocationGate()` (evento `kp:open-location-gate`).

### 2.2 — Auto-seleccionar sede "vitrina" al cargar /menu
`src/routes/menu.tsx`: en un `useEffect`, si no hay `activeSede` y `sedes.length > 0`, llamar `setExploringSede(sedes[0])` automáticamente. Así el menú renderiza solo, sin modal.

### 2.3 — Pill "📍 Ingresa tu ubicación" en el header
`src/components/kp/Layout.tsx` (header): mostrar un `BrutalButton` permanente que llame `openLocationGate()`. Texto dinámico:
- sin sede o `source === "exploring"` → "📍 Ingresa tu ubicación"
- con sede → "📍 {direccionTexto corta}"

Quita el render condicional del `ActiveSedePill` cuando esté vacío — el pill del header lo reemplaza.

### 2.4 — Trigger del gate en ProductCard
Ya existe (`if (!sede || source === "exploring") openLocationGate()`). Verificar que después de confirmar ubicación, el item se añade al carrito automáticamente. Para esto:
- Añadir a `LocationGate` un callback opcional `onConfirmed?: (sede) => void` y en `ProductCard` pasar una intención pendiente (guardar el producto en un ref/zustand mini-store `pendingProductIntent`). Tras confirmar, `addItem` + `openCart()`.
- Alternativa simple: tras confirmar gate exitoso, emitir evento `kp:gate-confirmed` y `ProductCard` re-ejecuta su `onClick` pendiente. Voy con la simple.

### 2.5 — Google Places Autocomplete (New)
Reemplazar el `BrutalInput` + botón "Buscar" del gate por `PlaceAutocompleteElement` (Places API New, browser key). Mantener fallback texto si la API no carga. Cuando el usuario selecciona una predicción → mover pin y reverseGeocode.

Archivo nuevo: `src/components/kp/PlacesAutocomplete.tsx`. Carga Maps JS con `libraries=places` (ya cargamos Maps JS en `GateMap`; centralizar el loader en `src/lib/google-maps.ts` para no duplicar scripts).

### 2.6 — Pickup fallback
Ya implementado. Verificar que en checkout se vea claramente "RECOGER EN TIENDA" cuando `enCobertura === false`.

---

## FASE 3 — Catálogo Maestro Global (requiere confirmación)

**Cambio grande de modelo.** Hoy `rp_categorias` y `rp_productos` son **por sede** (`sede_id` NOT NULL). El usuario pide un catálogo único administrado una sola vez; cada sede solo prende/apaga disponibilidad y stock.

### Modelo propuesto

```text
productos_master (global)
  id uuid pk
  rp_productogeneral_id int unique   -- id estable del POS
  categoria_master_id uuid
  nombre, descripcion, precio_base, imagen_url
  modificadores_raw jsonb
  orden int
  activo bool

categorias_master (global)
  id uuid pk
  rp_categoria_id int unique
  nombre, orden, activo

sede_producto_overrides
  sede_id uuid, producto_master_id uuid  (pk compuesta)
  disponible bool default true
  precio_override numeric null
  stock_cache numeric null
  almacen_id int
```

Sync: `syncBranches` igual. `syncAllMenus` ahora upsertea **a `*_master`** (no a tablas por-sede) y crea/actualiza filas en `sede_producto_overrides` (disponibilidad por sede).

Lectura pública (`getMenuForSede`): JOIN `productos_master` con `sede_producto_overrides WHERE sede_id = X AND disponible = true`.

Admin (`/admin/menu`): ya no pide sede; lista de `productos_master`. Reorden global, ocultar inactivos global. Un panel separado "Disponibilidad por sede" para apagar productos por sede puntual.

### Migración de datos
1. Crear tablas nuevas.
2. Backfill: para cada `(rp_productos)` agrupar por `rp_id` → insertar 1 fila en `productos_master`; insertar overrides por sede.
3. Reescribir `rp.functions.ts` (`syncAllMenus`, `getMenuForSede`, `listAdminMenu`, `update*`, `reorder*`).
4. Reescribir `src/routes/admin.menu.tsx` (sin selector de sede).
5. Mantener `rp_categorias`/`rp_productos` un tiempo como `_legacy` para rollback, después drop.

### Detalles técnicos para no romper RLS
- `productos_master`/`categorias_master`: lectura pública si `activo=true`; CRUD solo editor/super_admin (mismo patrón actual).
- `sede_producto_overrides`: lectura pública; CRUD editor/super_admin.

---

## Lo que NO está en este plan
- Cambios al diseño Neubrutalista (intacto).
- Pagos reales en checkout.
- WhatsApp template del checkout (ya existe).

---

## Preguntas antes de ejecutar

1. **Fase 3 (catálogo global) — ¿la ejecuto en este mismo loop o prefieres mergear Fases 1–2 primero y probar?** Es la migración más invasiva (cambia el modelo de BD y reescribe `/admin/menu`).
2. **Places Autocomplete (New)** — confirmo que uso `PlaceAutocompleteElement` browser-side con la `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` ya configurada. ✅ (no requiere acción tuya)
3. **`modificadores_raw`** — ¿guardo el JSON crudo completo (`listaModificadores + lista_productobase + lista_productoadicional`) o solo `listaModificadores`?
