## Flujo Gangster: Location First + Carrito Drawer

### Misión 1 — Normalizador (verificación rápida)

`src/lib/restaurantpe-normalize.ts` **ya aplica los fallbacks** que pides:
- Precio: lee `productogeneral_precio` → `lista_presentacion[0].producto_precio` → legacy, y descarta productos con precio 0.
- Imagen: lee `producto_urlimagen` de la presentación, luego `productogeneral_urlimagen`, y resuelve la URL absoluta con `https://api.restaurant.pe/archivos/` vía `resolveRpImage`.

**Acción única:** correr "Sincronizar TODOS los menús" en `/admin/sincronizacion` para reescribir las filas viejas que se guardaron antes del fix. No hay cambios de código en esta misión.

### Misión 2 — Location Gate (el peaje)

**Estado global de sede activa** (`src/lib/active-sede.ts`):
- Hook `useActiveSede()` con `useSyncExternalStore` + `localStorage` (`kp.activeSede = { sedeId, slug, source: 'gps' | 'address', label, ts }`).
- Helpers `setActiveSede`, `clearActiveSede`, `pickNearestSede(lat, lng, sedes)` usando Haversine contra `sedes.lat/lng` + `cobertura_radio_km`. Devuelve `{ sede, distanciaKm, enCobertura }` o `null` (más cercana fuera de cobertura → pickup).

**Componente `src/components/kp/LocationGate.tsx`**:
- Usa `Dialog` de shadcn (ya instalado) estilizado con `BrutalCard`. No cerrable hasta elegir.
- Carga `listPublicSedes`.
- Botón 1 "Usar mi ubicación" → `navigator.geolocation.getCurrentPosition` → `pickNearestSede` → si `enCobertura` guarda y cierra; si no, muestra tarjeta "Aún no llegamos a tu reino — recoge en {sede}" con CTA `Recoger en sede` o `Cambiar dirección`.
- Botón 2: input con autocompletado de Google Places (New API), cargando el script con `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` + `loading=async&callback=initKpMaps`. Al seleccionar lugar → tomar `location` → `pickNearestSede`.
- Persistencia: al éxito, `setActiveSede` y `queryClient.invalidateQueries(["menu"])`.

**Montaje**: en `src/routes/__root.tsx` dentro del shell, después del header, renderizar `<LocationGate />` que se auto-abre si `useActiveSede() == null` y la ruta es `/` o `/menu`. Header gana un pill "📍 {label} · Cambiar" que reabre el gate.

**Integración con `/menu`**:
- Reemplazar el `select` de sede por el pill del header + LocationGate.
- `sedeSlug` viene de `useActiveSede()` (no de search param), eliminando el fallback a `sedes[0]`.

### Misión 3 — Carrito Drawer (el gatillo)

**Estado del carrito** (`src/lib/cart.ts`):
- `useCart()` con `useSyncExternalStore` + `localStorage` (`kp.cart`).
- Items: `{ key, productoId, nombre, precio, cantidad, imagen, modificadores?: [] }`.
- API: `addItem(producto)`, `incItem(key)`, `decItem(key)`, `removeItem(key)`, `clear()`, selectores `subtotal`, `count`.
- Si el producto trae `modificadores.length > 0`, `addItem` retorna `{ requiereModal: true }`; sino lo agrega y dispara evento `kp:cart-open`.

**Componente `src/components/kp/CartDrawer.tsx`**:
- `Drawer` de shadcn (vaul) en posición `right` (override con clases — `Drawer direction="right"`).
- Renderiza header (sede activa), lista de items con +/- y eliminar, subtotal, `BrutalButton` "Ir a pagar" → `navigate('/checkout')` (placeholder route que ya existe o se crea vacía).
- Escucha `window` event `kp:cart-open` para abrir.
- Montado en `__root.tsx` junto a `LocationGate`.

**Botón flotante** en `__root.tsx` (visible cuando `count > 0`): pill brutal con `🛒 {count} · {cop(subtotal)}` que abre el drawer.

**`ProductCard` (`src/components/kp/ProductCard.tsx`)**:
- Cambiar el `onClick` de "Pedir esta corona" para llamar `addItem(producto)`. Si requiere modal → abrir un `ModificadoresDialog` (placeholder simple: por ahora solo agrega sin modificadores y deja `TODO` — los modificadores ya viven en `rp_productos` pero el modal completo queda fuera de este sprint).
- Mostrar feedback (toast sonner ya disponible) + abrir drawer.

### Archivos a crear / editar

```text
src/lib/active-sede.ts          NEW  store + haversine + pickNearestSede
src/lib/cart.ts                 NEW  store carrito + selectores
src/lib/google-maps-loader.ts   NEW  loader idempotente de Maps JS API
src/components/kp/LocationGate.tsx   NEW
src/components/kp/CartDrawer.tsx     NEW
src/components/kp/CartPill.tsx       NEW  pill flotante
src/components/kp/ActiveSedePill.tsx NEW  pill en header
src/routes/__root.tsx           EDIT montar LocationGate, CartDrawer, CartPill, ActiveSedePill
src/routes/menu.tsx             EDIT consumir useActiveSede, quitar select
src/components/kp/ProductCard.tsx    EDIT addItem + toast
src/lib/menu.ts                 EDIT exponer `modificadores` y `imagen` raw al ProductCard (Producto necesita campo opcional)
src/types/kp.ts                 EDIT añadir `modificadores?: NormalizedModifierGroup[]` opcional a Producto
```

No se requieren migraciones (la tabla `sedes` ya tiene `lat`, `lng`, `cobertura_radio_km`). No se tocan server functions ni RLS.

### Notas técnicas

- **Maps key**: se usa la `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` (referrer-restricted). El proyecto ya tiene el connector Google Maps. Sin geocoding server-side por ahora — `Place` devuelve `location` directamente.
- **SSR**: ambos stores leen `localStorage` solo dentro de `useSyncExternalStore` subscribe/getSnapshot con guardas `typeof window !== 'undefined'` (devuelven `null` en SSR). El Gate y el Drawer no se renderizan en SSR (return null si `!mounted`).
- **Sin pasarela**: el botón "Ir a pagar" navega a `/checkout` — si no existe se crea una página stub con resumen y "Próximamente pasarela / WhatsApp".
- **Diseño**: 100% tokens brutales existentes (`BrutalCard`, `BrutalButton`, `BrutalChip`). Sin colores hardcodeados.

### Fuera de alcance (siguiente sprint)
- Modal de modificadores completo (adiciones, salsas) — actualmente solo se agrega el producto base.
- Checkout real con pasarela y `registrarDelivery` a Restaurant.pe.
- Editor de polígonos de cobertura por sede (hoy usamos radio circular `cobertura_radio_km`).