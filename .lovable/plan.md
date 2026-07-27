
# Cotización de domicilio en checkout

Objetivo: el total del checkout deja de decir "A confirmar por WhatsApp". El costo del domicilio se calcula en el servidor, con distancia vial real, tarifa por ciudad configurable por sede, y se persiste como fuente única de verdad.

## 1. Migración de base de datos (sedes + orders)

Nuevas columnas en `public.sedes` (todas administrables desde /admin/sedes):
- `delivery_base_fee numeric` — tarifa base del primer km. Sin default (obligar a fijarlo por sede en admin; hasta que se fije, el checkout muestra error claro).
- `delivery_base_distance_km numeric NOT NULL DEFAULT 1`.
- `delivery_extra_km_fee numeric NOT NULL DEFAULT 1200`.
- `delivery_max_distance_km numeric` — opcional; si es NULL usa `cobertura_radio_km`.

Nuevas columnas en `public.orders` para auditoría:
- `delivery_fee numeric NOT NULL DEFAULT 0`.
- `delivery_distance_km numeric` (nullable — pickup queda NULL).

Seed inicial en la misma migración (UPDATE) para las sedes existentes según ciudad:
- Cali/Jamundí: `delivery_base_fee = 5000`.
- Bogotá: `delivery_base_fee = 7000`.

No se cambian políticas RLS (las existentes cubren estas columnas).

## 2. Server function `quoteDelivery`

Nuevo archivo `src/lib/delivery-quote.functions.ts` (thin wrapper) + `src/lib/delivery-quote.server.ts` (lógica).

Input validado con Zod:
```
{ sedeId: uuid, tipo: "delivery" | "pickup",
  destino: { lat: number, lng: number, direccion?: string } }
```

Handler (server-only, `supabaseAdmin`):
1. Si `tipo === "pickup"` → devuelve `{ deliveryFee: 0, distanceKm: 0, currency: "COP", sedeId, sedeNombre, ciudad }` sin llamar a mapas.
2. Lee sede: `id, nombre, ciudad, lat, lng, cobertura_radio_km, delivery, kill_switch, delivery_base_fee, delivery_base_distance_km, delivery_extra_km_fee, delivery_max_distance_km`.
   - Falla clara si la sede no ofrece delivery o le falta `delivery_base_fee` o coordenadas.
3. Llama a Google Routes API a través del gateway Lovable ya conectado (`routes/directions/v2:computeRoutes`, `travelMode: DRIVE`, `routingPreference: TRAFFIC_UNAWARE`, `X-Goog-FieldMask: routes.distanceMeters`). Origen = coordenadas de la sede. Destino = `destino.lat/lng`. Timeout 4s. Reutiliza el mismo patrón de `getCreds()` de `geocode.functions.ts`.
4. `distanceKm = distanceMeters / 1000`.
5. Valida cobertura: `distanceKm ≤ (delivery_max_distance_km ?? cobertura_radio_km)`. Si no → `{ ok: false, code: "OUT_OF_COVERAGE", distanceKm }`.
6. Fórmula (redondeo al peso, luego "aprox."):
   `deliveryFee = base + max(0, ceil(distanceKm - baseDistanceKm)) * extraKmFee`.
7. Devuelve `{ ok: true, distanceKm, deliveryFee, currency: "COP", sedeId, sedeNombre, ciudad }`.

Errores del proveedor de rutas → `{ ok: false, code: "ROUTES_UNAVAILABLE" }`. Nunca lanza secretos ni PII al log; solo status del gateway.

Función interna `computeDeliveryFee(distanceKm, sede)` exportada para reusar en `orders.server.ts`.

## 3. `orders.server.ts` — reconstruir cotización en servidor

- Extender `CheckoutInput` con `destino?: { lat, lng }` (obligatorio si `tipo === "delivery"`).
- Después de calcular `subtotal`, si `tipo === "delivery"`:
  1. Llama a `quoteDeliveryInternal({ sedeId, destino })` (no confía en nada del navegador).
  2. Si falla o queda fuera de cobertura → aborta con mensaje amigable; el pedido NO se crea.
  3. `total = subtotal + deliveryFee`.
- Persiste en `orders`: `delivery_fee`, `delivery_distance_km`, y también dentro de `rp_payload.delivery_quote = { distanceKm, deliveryFee, base, extraKmFee, ciudad, quotedAt }` para auditoría.
- Payload Restaurant.pe:
  - Verificar Swagger V2 (`RESTAURANT_PE_TENANT_TOKEN` ya disponible) para el campo oficial de costo de envío en `registrarDelivery`. Candidatos documentados a validar: `delivery_montoenvio` / `delivery_costoenvio`. Solo se agrega si aparece en la especificación oficial; **no inventar nombres**.
  - Si el campo existe → mapear `deliveryFee` allí.
  - Si no existe → concatenar `"[Domicilio $X, ~Y km]"` al inicio de `delivery_observacion` y dejar comentario en el código documentando la limitación. Supabase sigue siendo la fuente del total cobrado.
  - `delivery_pagocon` (efectivo) pasa a usar `total` (ya incluye envío).

## 4. Checkout UI (`src/routes/checkout.tsx`)

- Nuevo hook local: `useQuery(["deliveryQuote", sedeId, lat, lng, tipo])` con `queryFn` que llama al server fn `quoteDelivery`. `enabled = tipo === "delivery" && sede?.lat && sede?.lng && sede?.sedeId`. Debounce 300ms sobre lat/lng.
- Estado derivado:
  - `deliveryFee = tipo === "pickup" ? 0 : quote?.deliveryFee`.
  - `total = subtotal + (deliveryFee ?? 0)`.
  - `quoting = tipo === "delivery" && isFetching`.
  - `quoteReady = tipo === "pickup" || quote?.ok === true`.
  - `outOfCoverage = quote?.code === "OUT_OF_COVERAGE"`.
- `DetallesEntrega`:
  - Reemplaza "A confirmar por WhatsApp" por:
    - Estado cargando: "Calculando domicilio…"
    - Estado ok: `Domicilio ≈ $X` + fila secundaria `Distancia ≈ Y,Y km (vial)`.
    - Estado error: mensaje "No pudimos calcular el domicilio. Revisa la dirección o intenta nuevamente."
  - Total muestra `≈ $Z` con la nota "aprox." al lado (según pedido explícito del usuario).
- `ResumenPedido` recibe `subtotal`, `deliveryFee`, `total`, `quoting` y los muestra por separado.
- CTA (mobile + desktop): label incluye `total` recalculado; `disabled = enviando || !quoteReady`. Si `outOfCoverage`: bloquea el submit y ofrece cambiar a "Recoger en sede" (usa `setOrderType("pickup")` como ya existe).
- `buildOrderPayload()` incluye `destino: { lat: sede.lat, lng: sede.lng }` (coordenadas del cliente en `ActiveSede`). No envía `deliveryFee` — el servidor lo recalcula.
- Pickup: nunca llama al cotizador; muestra `Domicilio $0`.

## 5. Admin (`SedeForm.tsx`)

Nueva sección "Tarifa de domicilio":
- Inputs numéricos para `delivery_base_fee`, `delivery_base_distance_km`, `delivery_extra_km_fee`, `delivery_max_distance_km` (opcional).
- Validación: base > 0, extra ≥ 0. Guardado vía `updateSede` (ya usa `SedeUpdate` tipado de Supabase, así los nuevos campos aparecen automáticamente tras regenerar tipos).

## 6. Consistencia post-pedido

- `/gracias`, Mi Reino (pedidos), y `/admin/pedidos` ya leen `orders.subtotal / total`. Se agrega una fila "Domicilio" cuando `delivery_fee > 0` (lectura directa de las nuevas columnas). No cambia lógica de puntos (siguen calculándose sobre `total` como hoy vía `loyalty_earn_on_delivery`, lo que es congruente).

## 7. Pruebas manuales (con `delivery_base_distance_km=1`, `extra=1200`)

| Ciudad  | dist km | fee esperado |
|---------|---------|--------------|
| Cali    | 0.8     | $5.000       |
| Cali    | 1.1     | $6.200       |
| Cali    | 2.0     | $6.200       |
| Cali    | 2.1     | $7.400       |
| Bogotá  | 0.8     | $7.000       |
| Pickup  | —       | $0           |
| Fuera   | > radio | bloqueado    |

Se prueba también que manipular `deliveryFee` desde devtools no altera el total: el servidor recalcula y persiste su propio valor.

## 8. Fuera de alcance (no se toca)

- Diseño brutalista, textos de marca, tracker, webhook, reconciler.
- Sistema de puntos/loyalty.
- Reglas de cobertura ya existentes (solo se **complementan** con la validación explícita en `quoteDelivery`).

---

## Detalles técnicos

- Google Maps: Routes API vía gateway (`GATEWAY_URL/routes/directions/v2:computeRoutes`) con `LOVABLE_API_KEY` + `GOOGLE_MAPS_API_KEY_1`. Manejo de 403 con `error.details[].reason` (ya documentado en el proyecto).
- Server fn `quoteDelivery` es público (no requiere auth) porque el checkout también corre como invitado; no expone secretos y solo lee datos de sede + Routes.
- `orders.server.ts` importa `quoteDeliveryInternal` desde `delivery-quote.server.ts` (server-only), NO desde `.functions.ts`, para evitar RPC dentro del server.
- Tipos Supabase se regeneran tras aprobar la migración; hasta entonces, el código nuevo usará `as unknown as` mínimo solo donde sea imprescindible.
- Verificación: `bunx tsgo --noEmit` y prueba manual del flujo (mobile + desktop).
