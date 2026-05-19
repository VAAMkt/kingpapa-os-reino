## Problema

Al oprimir "📍 Usar mi GPS" el pin cae bien en el mapa, pero el recuadro **Dirección** queda vacío (solo el placeholder). El usuario espera que la dirección detectada aparezca ahí para luego escribir los **Detalles** y confirmar.

## Causa

En `src/lib/active-sede.ts` el input ya está enlazado con `value={pinLabel}`, así que el autollenado funcionaría si `pinLabel` tuviera valor. El problema real está en `src/lib/geocode.functions.ts > reverseGeocode`:

- Llama directamente a `https://maps.googleapis.com/maps/api/geocode/json` usando `process.env.GOOGLE_MAPS_API_KEY`.
- En este proyecto Google Maps está integrado vía el **conector gestionado de Lovable**, cuya key tiene restricción por *referrer* y **no está autorizada para Geocoding API llamada directa**. Devuelve `REQUEST_DENIED` y el handler retorna `{ ok: false }` en silencio (sin toast), por eso `pinLabel` se queda en string vacío y el input se ve "vacío".
- La documentación del conector exige enrutar Geocoding **a través del gateway** (`https://connector-gateway.lovable.dev/google_maps/...`) con headers `Authorization: Bearer ${LOVABLE_API_KEY}` y `X-Connection-Api-Key: ${GOOGLE_MAPS_API_KEY}`.

## Cambios

1. **`src/lib/geocode.functions.ts`**
   - Reemplazar la llamada directa a `maps.googleapis.com` por la ruta del gateway en **ambas** funciones (`geocodeAddress` y `reverseGeocode`), enviando los headers `Authorization` y `X-Connection-Api-Key`. La key se obtiene de `process.env.GOOGLE_MAPS_API_KEY` y `process.env.LOVABLE_API_KEY`.
   - Si falta alguna credencial → `{ ok: false, error: "Google Maps no configurado" }` (igual que hoy).
   - El shape de la respuesta JSON de Geocoding API se mantiene, así que el resto del código no cambia.

2. **`src/components/kp/LocationGate.tsx`** (mejora UX pequeña para que el usuario sepa qué pasó)
   - En `updatePin`, si `reverseFn` devuelve `ok: false`, mostrar un `toast.error("No pudimos detectar la dirección, escríbela manualmente")` y dejar el input vacío para que la pueda tipear. Hoy falla en silencio.

No se toca el layout ni el orden visual: el flujo sigue siendo **GPS → mapa → Dirección (autollenada) → Detalles (usuario) → Confirmar ubicación**, que es exactamente lo que pide el usuario.

## Verificación

- En `/menu`, abrir el gate, oprimir "Usar mi GPS".
- Esperado: el recuadro **Dirección** se llena con la dirección detectada (p. ej. "Carrera 63 #..., Cali"). El usuario escribe en **Detalles** y oprime **Confirmar ubicación**.
- Si por algún motivo el gateway falla, aparece un toast claro y el input queda editable.
