# Calificaciones de Google por sede

Mostrar la reputación real de KINGPAPA (4.8–4.9 con miles de reseñas) en el sitio, con carga manual desde el admin mientras no exista integración con Google Business Profile.

## 1. Base de datos

Migración sobre la tabla `sedes` con dos columnas nuevas, ambas opcionales:

- `google_rating` — número con un decimal (ej. 4.8), validado entre 0 y 5.
- `google_reviews_count` — entero de reseñas, validado como no negativo.

Sin cambios de permisos: las sedes publicadas ya son legibles públicamente.

## 2. Admin

En el formulario de sedes (`src/components/admin/SedeForm.tsx`, usado tanto por crear como por editar) se agrega un bloque "Reputación Google" con dos campos numéricos:

- Calificación Google (0–5, un decimal)
- Cantidad de reseñas

Ambos vacíos = `null`. Validación en el esquema Zod del formulario: rating entre 0 y 5, reseñas entero ≥ 0. Se guardan igual que el resto de campos.

## 3. Visualización pública

Solo cuando **ambos** valores existen:

- **Tarjeta de sede** (`LocationCard`, usada en `/sedes` y en el bloque del home): badge compacto `⭐ 4.8 (8.430 reseñas)` bajo la dirección. El número de reseñas se formatea con separador de miles fijo (punto), sin depender del locale del navegador, para no romper la hidratación.
- **Página de sede** (`/sedes/{slug}`): el mismo badge junto a los badges de estado/ciudad en el encabezado.

Si falta cualquiera de los dos, no se muestra nada.

## 4. Datos estructurados

En el JSON-LD `Restaurant` de `/sedes/{slug}` se agrega `aggregateRating` con `ratingValue`, `reviewCount` y `bestRating: 5`, **únicamente** si ambos campos tienen valor. El `ItemList` genérico de `/sedes` en `seo-schema.ts` no se toca.

## Notas técnicas

- Archivos: migración; `src/components/admin/SedeForm.tsx`; `src/components/kp/Cards.tsx`; `src/routes/sedes_.$slug.tsx`.
- `src/lib/sedes.ts` no requiere cambios (usa `select("*")` y tipos generados).
- Los tipos de la base se regeneran tras aplicar la migración, así que el código de UI se escribe después de aprobarla.
- Formato de miles con helper propio para mantener idéntico el render en servidor y navegador.
