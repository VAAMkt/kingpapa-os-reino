# Sincronización automática del rating de Google

Reemplazar la carga manual de `google_rating` / `google_reviews_count` por una sincronización contra la API Places (New) de Google, con botón manual por sede y job semanal.

Importante: este proyecto corre sobre TanStack Start, donde la lógica de servidor va en server functions y rutas de servidor, no en Edge Functions de Supabase. La sincronización se implementa con ese patrón (funcionalmente equivalente: invocable por sede desde el admin y por el cron semanal), siguiendo el mismo esquema del job ya existente `/api/public/hooks/rp-reconcile`.

## 1. Base de datos (migración)

En la tabla `sedes`, dos columnas nuevas y opcionales:

- `google_place_id` (texto) — identificador de Google Places, se carga una vez.
- `google_rating_synced_at` (fecha/hora) — momento de la última sincronización exitosa.

Sin cambios de permisos ni de reglas de acceso.

## 2. Lógica de sincronización

Nuevo módulo de servidor `src/lib/google-places.server.ts`:

- Lee la API key desde el secret `GOOGLE_PLACES_API_KEY` (dentro del handler, nunca en el código).
- Por cada sede con `google_place_id`: `GET https://places.googleapis.com/v1/places/{place_id}` con headers `X-Goog-Api-Key` y `X-Goog-FieldMask: rating,userRatingCount`.
- Escribe `google_rating`, `google_reviews_count` y `google_rating_synced_at` en esa fila (cliente admin de servidor).
- Cada sede se procesa de forma aislada: un place_id inválido o un error de la API no detiene las demás; el error se registra en `rp_sync_log` (tipo `google_places_sync`) y se devuelve en el resumen.
- Dos modos: todas las sedes, o una sola por `sede_id`.

Puntos de entrada:

- `src/lib/google-places.functions.ts` — `syncGoogleRatings` protegida con autenticación y verificación de rol (`super_admin` / `editor`), usada por el botón del admin.
- `src/routes/api/public/hooks/sync-google-ratings.ts` — ruta POST para el cron, protegida con el header `apikey` igual que `rp-reconcile`; sincroniza todas las sedes. GET devuelve un estado informativo.

## 3. Admin de sedes

En `src/components/admin/SedeForm.tsx`, el bloque "Reputación Google" pasa a:

- Campo de texto editable: **Google Place ID**.
- **Calificación** y **Reseñas**: solo lectura, mostradas como referencia junto a "Última sincronización: {fecha}" (o "Nunca sincronizado").
- Botón **Sincronizar ahora** (solo al editar una sede existente): muestra "Sincronizando…", deshabilitado mientras espera, y al terminar refresca los valores en pantalla e informa éxito o error con un toast.

Se elimina la validación de rango manual de rating/reseñas y esos campos dejan de enviarse en el guardado del formulario.

## 4. Job semanal

Una vez desplegado el hook, se programa con `pg_cron` + `pg_net` (mismo patrón del proyecto): una llamada semanal (domingos 03:00) a `/api/public/hooks/sync-google-ratings` en la URL estable del proyecto, con el header `apikey`.

## Antes de que funcione

**Debes crear el secret `GOOGLE_PLACES_API_KEY`** con una API key real de Google Cloud que tenga habilitada la **Places API (New)**. La key existente de Maps es de conector y no se reutiliza aquí. Sin ese secret, la sincronización responderá con error de configuración.

También hay que cargar el `google_place_id` de cada sede una vez desde el admin; sin él, esa sede se omite.

## Sin cambios

El badge en `/sedes` y `/sedes/$slug`, y el `aggregateRating` del JSON-LD siguen exactamente igual: leen `google_rating` / `google_reviews_count`, que ahora se actualizan solos.
