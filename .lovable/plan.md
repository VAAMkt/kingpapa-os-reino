
# LocationGate v2 — Flujo Gangster (no bloqueante, con mapa)

## Prerrequisito: clave de Google Maps para el navegador

Hoy en el proyecto sólo existe `GOOGLE_MAPS_API_KEY` (server-side, usada en `geocode.functions.ts`). **No** existe `VITE_GOOGLE_MAPS_API_KEY` ni una clave restringida por *referrer* segura para embeber en el HTML. Para cargar el Maps JavaScript API en el navegador necesitamos una clave pública.

**Recomiendo conectar el connector "Google Maps Platform" de Lovable** (un click). Eso expone `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` ya restringida por dominio — es lo que usaremos para Maps JS + Places (New) en el cliente. El `GOOGLE_MAPS_API_KEY` server-side se mantiene para Geocoding desde server functions.

Confírmame si quieres que conectemos ese connector antes de implementar (es el camino limpio). Si prefieres usar tu propia API key, te pediré subirla como `VITE_GOOGLE_MAPS_API_KEY`.

## Cambios por paso

### Paso 1 — Navegación libre (sin esposas)
- En `LocationGate`: el modal sigue auto-abriendo en el primer ingreso si no hay sede activa, **pero**:
  - Se puede cerrar con `Esc` y clic afuera (quitar los `e.preventDefault()`).
  - Nuevo botón secundario "Solo quiero explorar la carta" (`BrutalButton variant="ghost"`).
  - Al cerrarlo sin elegir, seteamos una "sede vitrina" (la primera publicada) con `source: "exploring"` y `enCobertura: false` para que `/menu` cargue productos.
- En `ProductCard` (botón "Pedir esta corona"): si la sede activa es `exploring` o `enCobertura === false`, abrimos el `LocationGate` antes de hacer `addItem`. Es ahí donde forzamos la validación, no al entrar.
- Añadir `"exploring"` al union `source` en `src/lib/active-sede.ts`.

### Paso 2 — Mapa visual + pin arrastrable
- Nuevo componente `src/components/kp/GateMap.tsx`:
  - Carga Maps JS con `loading=async&callback=...&channel=...` usando `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`.
  - Mantiene un `google.maps.Map` y un `google.maps.Marker` con `draggable: true` (no usamos `AdvancedMarkerElement` para no exigir `mapId`).
  - Props: `center`, `onPinChange(lat, lng)`.
  - Loader único a nivel de módulo (no recargar el script).
  - Render fallback con `<Skeleton>` mientras se inicializa.
- `LocationGate` mantiene `pin: {lat, lng} | null`. Cuando hay pin, mostramos el mapa y la dirección humana debajo.

### Paso 3 — Reverse geocoding + dirección editable
- Nueva server function `reverseGeocode(lat, lng)` en `src/lib/geocode.functions.ts` (mismo patrón que `geocodeAddress`, endpoint `latlng=...`, `region=co`, `language=es`).
- Al obtener pin (GPS, autocomplete o arrastrar marker), llamamos `reverseGeocode` y mostramos:
  - `BrutalInput` con la dirección formateada (editable).
  - `BrutalInput` para "Detalles (Apto, casa, referencia)".
- Al confirmar, guardamos en `ActiveSede`:
  - Extendemos el tipo con `direccionTexto?: string`, `detalles?: string`, `lat?: number`, `lng?: number`.
  - Migración suave: campos opcionales, lectura existente sigue funcionando.

### Paso 4 — Matemática de cobertura + Pickup fallback
- `pickNearestSede` ya usa Haversine en km correctamente — el bug real es que muchas sedes tienen `lat/lng` en null (filtramos y devolvemos `null` → mensaje "no hay sedes"). Verificación rápida via `psql` antes de implementar.
- Cambios:
  - Radio por defecto: subir de 5 km → **7 km** cuando `cobertura_radio_km` es null/0.
  - Si todas las sedes carecen de coordenadas: caer al primer sede publicada como "vitrina" + mostrar aviso "Sólo recoger".
  - Si el punto del usuario está fuera del radio de la sede más cercana: **no bloquear**. Mostrar pantalla "Estás fuera de zona de domicilio — recoges en {sede}", con `BrutalButton` "Pedir para recoger" que activa `pickup` en el `ActiveSede` (`enCobertura: false` ya lo modela; el `CartDrawer` ya muestra "Recoger" en ese caso).
- En `/checkout`: si `enCobertura === false`, ocultar input de dirección de entrega y mostrar la dirección de la sede para recoger.

### Paso 5 — Skeletons y feedback visual
- Mientras se pide GPS / carga Maps JS / corre reverse geocoding: usar `<Skeleton>` (ya existe en `src/components/ui/skeleton.tsx`) en lugar de sólo texto "Leyendo GPS…".
- Toasts con `sonner` ya están — añadir uno para "Pin movido, recalculando dirección…" con `loading`/`success` ids.

## Archivos a tocar

```text
src/lib/active-sede.ts            (extender ActiveSede, añadir "exploring", subir radio default a 7)
src/lib/geocode.functions.ts      (añadir reverseGeocode)
src/components/kp/LocationGate.tsx (rediseño UX: navegable, mapa, dirección editable, pickup fallback)
src/components/kp/GateMap.tsx     (NUEVO — mapa + marker arrastrable)
src/components/kp/ProductCard.tsx  (gate en click "Pedir" si exploring/fuera cobertura)
src/routes/checkout.tsx           (modo recoger vs delivery según enCobertura)
```

No se tocan: `cart.ts`, otros componentes, ni el estilo Neubrutalista global.

## Fuera de alcance
- Sustituir el connector Google Maps por Mapbox/Leaflet.
- Autocomplete Places (lo dejamos como mejora siguiente; ahora seguimos con `geocodeAddress` por texto + el mapa para precisión).
- Pago real (sigue WhatsApp).

## Confirmaciones que necesito antes de implementar
1. ¿Conectamos el connector **Google Maps Platform** de Lovable para tener la browser key? (recomendado)
2. ¿OK subir el radio default a 7 km cuando la sede no define el suyo?
3. ¿Confirmo que la sede "vitrina" (modo explorar) sea la primera publicada por `orden`?
