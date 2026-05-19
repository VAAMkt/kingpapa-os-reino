## Diagnóstico

El GPS sí funciona: el mapa recibe lat/lng correctos y centra el pin. El fallo está después, en la llamada servidor `reverseGeocode`.

La evidencia directa es la respuesta de red:

```text
reverseGeocode -> ok: false, error: "Reverse 401"
```

Revisé las credenciales disponibles sin exponer valores:

```text
GOOGLE_MAPS_API_KEY   -> 401 unauthorized
GOOGLE_MAPS_API_KEY_1 -> 200 skipped/valid
```

Causa real: `src/lib/geocode.functions.ts` está usando `process.env.GOOGLE_MAPS_API_KEY`, pero la conexión válida del gateway quedó inyectada como `GOOGLE_MAPS_API_KEY_1`. Por eso Google Maps JS del navegador posiciona bien el mapa, pero el reverse geocode del servidor falla con 401 y nunca llena “Dirección detectada”.

## Plan de implementación

1. Actualizar `src/lib/geocode.functions.ts`
   - Cambiar `getCreds()` para tomar la primera credencial válida disponible:
     - `GOOGLE_MAPS_API_KEY_1`
     - fallback a `GOOGLE_MAPS_API_KEY`
   - Mantener `LOVABLE_API_KEY` como autorización del gateway.
   - No exponer ninguna clave al frontend.

2. Mejorar el error interno sin cambiar la UI
   - Cuando el gateway devuelva 401/403, retornar un error específico tipo “credencial no autorizada” para que sea diagnosticable.
   - Mantener el toast actual para el cliente: “No pudimos detectar la dirección, escríbela manualmente”.

3. Verificación
   - Probar una llamada de reverse geocode con coordenadas como las del GPS actual.
   - Confirmar que devuelve `ok: true` y `label` con dirección formateada.
   - Luego el input “Dirección detectada” quedará lleno automáticamente y el usuario solo ingresa “Detalles” y confirma ubicación.

## Archivos a tocar

- `src/lib/geocode.functions.ts`

No tocaré el mapa, el diseño ni el flujo de confirmación.