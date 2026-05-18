# Plan: Integración KINGPAPA × Restaurant.pe (todo el stack, sin pasarela)

Reemplazamos los mocks por datos reales de Restaurant.pe v2, en arquitectura **híbrida**: catálogo cacheado en Supabase + validación live al pedir. Sin pasarela de pago (queda pendiente). Sin rediseño visual: solo se cambian fuentes de datos y se añaden 3 piezas nuevas (CartDrawer, Customizer, OrderTracker) usando los componentes Brutal existentes.

---

## 0. Pre-requisitos (un solo turno antes de implementar)

1. Confirmar `RESTAURANT_PE_TOKEN` y `RESTAURANT_PE_DOMINIO` ya configurados (✅ presentes).
2. Pedir `VITE_GOOGLE_MAPS_API_KEY` (Maps JavaScript API + Geocoding + Distance Matrix habilitados).
3. Confirmar el `dominio_id` numérico real de KINGPAPA en Restaurant.pe (el secret guarda el dominio, necesitamos también el ID).
4. Confirmar mapeo sede Lovable ⇄ `local_id` Restaurant.pe (añadiremos columna `rp_local_id` a `public.sedes`).

---

## 1. Capa de datos: tipos + cliente server-only

**Crear**

- `src/types/restaurantpe.ts` — DTOs crudos del swagger (`RpDominioResponse`, `RpLocal`, `RpProducto`, `RpCategoria`, `RpModificadorGrupo`, `RpStockResponse`, `RpDeliveryCreateRequest/Response`, `RpEstadoPedido`).
- `src/types/kp-menu.ts` — tipos normalizados de UI (`KpMenuItem`, `KpModifierGroup`, `KpCartLine`, `KpOrder`, `KpOrderStatus`).
- `src/lib/restaurantpe.server.ts` — cliente fetch contra `http://api.restaurant.pe/restaurant/public/v2/rest`, con header `Authorization: Token token="${RESTAURANT_PE_TOKEN}"`, timeout, retry x2, parseo de envoltura `{ tipo, data, mensajes }`. **Server-only** (extensión `.server.ts` bloquea el bundle cliente).
- `src/lib/restaurantpe-normalize.ts` — funciones puras `normalizeProduct`, `normalizeBranch`, `normalizeOrderStatus` (importables desde cliente, sin secretos).

**Reglas**

- Nunca llamar Restaurant.pe desde React. Todo pasa por `createServerFn`.
- Mapear errores de la API (`tipo !== "1"`) a `Error` con mensaje legible.

---

## 2. Sync híbrido del menú

**Migración Supabase** (`supabase/migrations/<ts>_rp_catalog.sql`)

- `public.sedes`: añadir `rp_local_id int unique`, `lat numeric`, `lng numeric`, `cobertura_radio_km numeric default 5`.
- `public.rp_categorias`: `id uuid pk, rp_id int, sede_id uuid fk, nombre, orden, activo`.
- `public.rp_productos`: `id uuid pk, rp_id int, sede_id uuid fk, categoria_id uuid fk, nombre, descripcion, precio numeric, imagen_url, disponible bool, modificadores jsonb, almacen_id int null, stock_cache numeric null, updated_at`.
- `public.rp_sync_log`: `id, tipo (menu|branches|order), payload jsonb, ok bool, mensaje, created_at`.
- RLS: `SELECT` público para categorías y productos donde `disponible=true`; CRUD solo `super_admin`/`editor`.
- Triggers `set_updated_at`.

**Server functions** (`src/lib/rp.functions.ts` — solo declaraciones server-fn)

- `syncBranches()` — admin; pulla `obtenerInformacionDominio`, hace upsert en `sedes` por `rp_local_id`.
- `syncMenuForSede({ sedeId })` — admin; pulla catálogo del local, upsert en `rp_categorias`/`rp_productos`, marca productos huérfanos como `disponible=false`, registra en `rp_sync_log`.
- `getMenuForSede({ sedeId })` — público; lee desde Supabase.
- `checkStockLive({ sedeId, productIds })` — público (RLS-safe); consulta `getStockProducto` para cada producto antes del checkout.

**Admin UI** (`src/routes/admin.sincronizacion.tsx`)

- Tarjetas con "Sincronizar sedes" y por sede "Sincronizar menú" (botones que disparan mutaciones).
- Tabla con últimos 20 registros de `rp_sync_log`.
- Item nuevo en `adminNav`.

---

## 3. `/menu` — menú real por sede

**Modificar `src/routes/menu.tsx**`

- `validateSearch`: ya acepta `sede`. Si falta, mostrar selector de sede (lista de `sedes` publicadas) — sin redirigir.
- Reemplazar `import { productos } from "@/data/productos"` por `useQuery(['menu', sedeSlug], () => getMenuForSede(...))` (TanStack Query ya configurado).
- Mantener `ProductCard`, `BrutalChip` para filtros (categorías reales).
- Badge "Agotado en esta sede" cuando `disponible=false` (en lugar de ocultar).
- Botón "Pedir esta corona" en `ProductCard`:
  - Si el producto tiene modificadores → abre `ProductCustomizerDialog`.
  - Si no → añade al carrito directo.

**Deprecar** `src/data/productos.ts` (dejar archivo con `@deprecated` para fallback de dev).

---

## 4. Carrito brutal (estado cliente)

**Crear**

- `src/stores/cart.ts` — Zustand store con persist en `localStorage`. Estado: `sedeId`, `lines: KpCartLine[]`, `notes`, `canal: 'delivery'|'pickup'|'mesa'`. Acciones: `addLine`, `updateQty`, `removeLine`, `clear`, `setCanal`. Si cambia `sedeId`, limpia carrito (los precios y disponibilidad son por sede).
- `src/components/kp/CartDrawer.tsx` — Sheet (de shadcn ya disponible) usando `BrutalCard`/`BrutalButton`. Muestra subtotal, domicilio (placeholder 0 hasta tener tarifa), puntos a ganar, total. CTA: "Pedir directo al Reino" → `/checkout`.
- `src/components/kp/ProductCustomizerDialog.tsx` — Dialog con grupos de modificadores (radio/checkbox según `min/max` del grupo) y notas.
- Botón flotante con contador en `Layout` (esquina inferior-derecha, estilo brutal, fixed).

**No tocar** `OrderRouter` (Rappi/DiDi/WhatsApp) — pasa a ser respaldo secundario en `/menu`.

---

## 5. Geolocalización + sede sugerida

**Secret nuevo**: `VITE_GOOGLE_MAPS_API_KEY` (público, va al bundle).

**Crear**

- `src/lib/geo.ts` — `haversineKm(a,b)`, `geocodeAddress(address)` usando Google Geocoding API (fetch directo, key pública).
- `src/components/kp/SedeRouter.tsx` — modal/sección con 2 botones: "Usar mi ubicación" (browser geolocation) o "Escribir dirección" (Google Places Autocomplete).
- Lógica `pickSedeForUser(lat, lng, sedes)`: ordena por haversine, filtra por `cobertura_radio_km` y `abierta_ahora`, devuelve sede sugerida.
- Integrar en `/menu` (cuando no hay `?sede=`) y en `CartDrawer` antes de checkout.

---

## 6. Checkout sin pago

**Crear**

- `src/routes/checkout.tsx` — formulario: nombre, celular, canal (delivery/pickup/mesa), dirección + referencia (si delivery), método de pago (solo "Efectivo / por definir" — pasarela pendiente).
- Server fns en `src/lib/orders.functions.ts`:
  - `quoteOrder({ sedeId, lines, canal, address? })` — valida con `checkStockLive` + recalcula totales server-side.
  - `createOrder({ ...quote, customer })` — llama `POST /delivery/...` (endpoint truncado en swagger; usar el de creación de delivery). Guarda snapshot en `order_snapshots` y devuelve `publicToken` (uuid) + `restaurantpe_order_id`.
- Tras crear: redirigir a `/pedido/$publicToken`. Pago queda como `pending_payment`.

**Migración Supabase** (`order_snapshots`)

- `id, public_token uuid unique, user_id uuid null, sede_id uuid, rp_order_id text null, canal text, estado text, lines jsonb, totales jsonb, cliente jsonb, created_at, updated_at`.
- RLS: público SELECT por `public_token` (sin listar); usuario logueado ve los suyos por `user_id`; editores ven todos.

---

## 7. Tracker de pedido

**Crear**

- `src/routes/pedido.$publicToken.tsx` — público, no requiere login. Muestra estados con timeline brutal: `draft → pending_payment → paid → accepted → preparing → ready/out_for_delivery → delivered`. Polling cada 20s con React Query (`refetchInterval`).
- `src/routes/mi-reino.pedidos.tsx` — reemplazar mock por `listMyOrders()` (server fn con `requireSupabaseAuth`).
- Server fn `pollOrderStatus({ publicToken })` — server-only: lee snapshot, si tiene `rp_order_id` consulta estado real en Restaurant.pe, actualiza snapshot.

(Webhook entrante de Restaurant.pe queda **fuera de scope** de esta entrega — si la API lo soporta, se añade después en `/api/public/webhooks/restaurantpe`.)

---

## 8. Lealtad básica (sin gamificación avanzada)

**Migración**

- `public.loyalty_ledger`: `id, user_id, order_snapshot_id null, tipo (earn|redeem|adjust|expire), puntos int, motivo, created_at`. RLS: usuario ve los suyos; editores ven todos.
- Trigger: cuando `order_snapshots.estado` cambia a `delivered` y tiene `user_id`, insertar `earn` con `floor(totales.total / 100)` puntos.

**UI**

- Actualizar `src/routes/mi-reino.puntos.tsx` para leer saldo real de `loyalty_ledger` (sum agrupado).
- Mostrar "Ganarás X puntos" en `CartDrawer`/`/checkout` (calculado client-side, validado server-side al crear orden).

(Cupones, badges, favoritos → fase posterior.)

---

## 9. Detalles técnicos importantes

- **Boundary client/server**: todo lo que toca `RESTAURANT_PE_TOKEN` vive en `*.server.ts` o dentro de un `.handler()` de `createServerFn`. `rp.functions.ts` mantiene **solo** declaraciones de server-fn (regla `tss-serverfn-split`).
- **Validación**: todos los inputs de server-fn con Zod (productos, cantidades, sede, dirección).
- **Idempotencia**: `createOrder` usa client-side `requestId` (uuid) almacenado en `order_snapshots.public_token` para evitar duplicados.
- **Cache menú**: React Query `staleTime: 5min`. Sync manual desde admin invalida `['menu', sedeSlug]`.
- **No tocar**: `Layout`, `BrutalCard`, `BrutalButton`, `BrutalChip`, `ProductCard` (solo se les pasan props nuevos), paleta, tipografía.

---

## Archivos — resumen

**Crear** (~18)

- `src/types/restaurantpe.ts`, `src/types/kp-menu.ts`
- `src/lib/restaurantpe.server.ts`, `src/lib/restaurantpe-normalize.ts`, `src/lib/rp.functions.ts`, `src/lib/orders.functions.ts`, `src/lib/geo.ts`
- `src/stores/cart.ts`
- `src/components/kp/CartDrawer.tsx`, `src/components/kp/ProductCustomizerDialog.tsx`, `src/components/kp/SedeRouter.tsx`, `src/components/kp/CartFab.tsx`, `src/components/kp/OrderTimeline.tsx`
- `src/routes/checkout.tsx`, `src/routes/pedido.$publicToken.tsx`, `src/routes/admin.sincronizacion.tsx`
- 3 migraciones SQL: `rp_catalog`, `order_snapshots`, `loyalty_ledger`

**Modificar**

- `src/routes/menu.tsx` (datos reales + customizer)
- `src/routes/mi-reino.pedidos.tsx`, `src/routes/mi-reino.puntos.tsx` (datos reales)
- `src/components/kp/Layout.tsx` (montar `CartFab`)
- `src/routes/admin.tsx` (item "Sincronización")
- `src/components/kp/ProductCard.tsx` (handler `onPedir` recibido por prop, sin cambiar visual)

**Deprecar**: `src/data/productos.ts` (fallback dev).

---

## Entregables por commits (8 turnos pequeños)

1. Migraciones + tipos + cliente `restaurantpe.server.ts` + server-fns de sync.
2. Admin `/admin/sincronizacion` + columna `rp_local_id` en sede form.
3. `/menu` conectado a Supabase (datos reales sin carrito).
4. CartStore + CartDrawer + CartFab + Customizer.
5. SedeRouter + integración Google Maps (necesita el secret).
6. `/checkout` + `quoteOrder` + `createOrder` + `order_snapshots`.
7. `/pedido/$token` tracker + polling + `/mi-reino/pedidos` real.
8. Loyalty ledger + trigger + puntos reales en `/mi-reino/puntos`.

Cada commit es testeable y reversible. Pasarela y webhooks de pago quedan para una fase posterior con su propio plan.  
  
Documentación de la API: [APIV2 | 2 | RESTAURANT.PE | Studio](https://app.swaggerhub.com/apis-docs/RESTAURANT.PE/APIV2/2?view=elementsDocs)