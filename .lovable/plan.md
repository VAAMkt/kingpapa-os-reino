## Conectar Google Maps con tu clave propia para `kingpapa.co`

Tienes la clave lista y bien restringida (4 dominios + las APIs correctas). El siguiente paso es agregarla a Lovable como **conexión personalizada** de Google Maps, paralela a la actual gestionada.

### Pasos al pasar a build mode

1. **Abrir el diálogo de conector** con `standard_connectors--connect` (`connector_id: google_maps`).
   - Elegirás **"Crear nueva conexión"** (no la gestionada) y pegarás `AIzaSyAiuC4KKYakHPcCJO3B4AIwuI18D4Zmnd0` ahí.
   - Lovable la guarda cifrada y la inyecta como `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` + `GOOGLE_MAPS_API_KEY` en el runtime, reemplazando a la gestionada.
   - **Importante:** por seguridad, después de guardarla, **rota la clave en Google Cloud** (regenerar) — ya quedó expuesta al compartirla por chat. La nueva clave la pegas igual en el diálogo.

2. **Verificar** con `secrets--fetch_secrets` que los nuevos valores reemplazaron a los antiguos.

3. **Publicar** el proyecto para que `kingpapa.co` use la clave nueva. El mapa de `GateMap.tsx` y el autocomplete de `PlacesAutocomplete.tsx` empezarán a cargar sin `RefererNotAllowedMapError`.

### Sobre "eliminar APIs que no usemos"

En el código actual solo usamos **3 APIs**:

| API | Dónde |
|---|---|
| Maps JavaScript API | `src/lib/google-maps.ts` (mapa) |
| Places API (New) | `src/components/kp/PlacesAutocomplete.tsx` |
| Geocoding API | `src/lib/geocode.functions.ts` (server) |

Las otras 30 que tienes habilitadas (Routes, Air Quality, Pollen, Solar, Weather, Street View, Aerial, Tiles, Roads, etc.) **no se llaman desde el código**. Puedes deshabilitarlas en Google Cloud para reducir superficie de ataque y costo:

**Recomendación: deja habilitadas solo estas 3** y deshabilita el resto. Si en el futuro agregamos rutas/clima/etc., las re-habilitamos en 30 segundos.

Lo mismo en la **restricción de la clave** ("APIs a las que se puede acceder"): déjala restringida solo a esas 3.

### Secretos en Lovable Cloud

No hay nada que limpiar ahí — Google Maps no guarda secretos por API individual, solo la clave del conector. Lo único que cambia al conectar la personalizada es que `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` y `GOOGLE_MAPS_API_KEY` pasan a apuntar a tu clave en vez de a la gestionada.

### Acción inmediata recomendada

1. **Rota la clave en Google Cloud ahora** (porque la compartiste por chat).
2. Avísame cuando tengas la nueva y paso a build mode para abrir el diálogo de conexión.
3. Mientras tanto, en Google Cloud puedes ir deshabilitando las APIs que listé como no usadas.