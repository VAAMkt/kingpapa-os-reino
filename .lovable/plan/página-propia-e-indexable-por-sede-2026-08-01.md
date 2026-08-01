# Página propia e indexable por sede

Cada sede publicada tendrá su URL real (`/sedes/{slug}`) con título, descripción, canonical y datos estructurados propios, para competir en búsquedas locales ("salchipapas + barrio/ciudad"). No se toca el checkout ni el selector de sede activa.

## 1. Consulta por slug

En `src/lib/sedes.ts`, nueva función `getSedeBySlug(slug)`: busca en `sedes` por `slug` con `publicado = true` y devuelve la fila o `null`.

## 2. Nueva ruta de detalle

Archivo `src/routes/sedes_.$slug.tsx` (el guion bajo final evita que `/sedes` se convierta en layout de sus hijas y que la lista actual deje de renderizar; la URL pública sigue siendo `/sedes/{slug}`).

- **Loader**: `getSedeBySlug(params.slug)` cacheado con `queryClient.ensureQueryData`; si no hay sede, `throw notFound()`.
- **head()**:
  - title: `KINGPAPA {nombre} — Salchipapas a domicilio en {ciudad}` recortado a 60 caracteres.
  - description con dirección, barrio/mall y ciudad.
  - `og:title`, `og:description`, `og:url`, `og:type: business.business`, `twitter:card`.
  - canonical absoluto `https://kingpapa.co/sedes/{slug}` (constante `SITE_URL` de `seo-schema.ts`).
  - Cuando el loader no trajo sede: título genérico + `robots: noindex`.
- **JSON-LD**: dos scripts propios de la ruta — un `Restaurant` con `@id` `https://kingpapa.co/sedes/{slug}#restaurant`, `name`, `address` (PostalAddress con `direccion`, `ciudad`, `addressCountry: CO`), `servesCuisine: ["Colombian","Fast Food","Salchipapa"]`, `openingHours` desde `horario`, `telephone` desde `whatsapp` si existe, `geo` si hay `lat`/`lng`, y `url` de la propia página; y un `BreadcrumbList` Inicio > Sedes > {nombre}. No se reutiliza el ItemList de `/sedes`.
- **Contenido**: breadcrumb visible, H1 con el nombre, badges de abierto/cerrado y de delivery / pick-up / QR mesa según los booleanos, dirección, barrio o mall, horario, y dos botones: "Pedir aquí" a `/menu?sede={slug}` (mismo patrón `Link to="/menu" search={{ sede }}` que ya usa la tarjeta) y "Cómo llegar" con `maps_url` (fallback a búsqueda en Google Maps, igual que hoy).
- **notFoundComponent** y **errorComponent** con mensaje de marca y enlace de vuelta a `/sedes`.

## 3. Enlazar las tarjetas

En `src/components/kp/Cards.tsx` (`LocationCard`, usada tanto por `/sedes` como por el bloque "Encuentra tu castillo" del home): el nombre y la dirección pasan a ser un `Link to="/sedes/$slug"` con el slug real. Los botones "Pedir aquí" y "Cómo llegar" quedan exactamente como están. Con esto quedan cubiertos los puntos 3 y 4 sin duplicar código en `sedes.tsx` ni en `index.tsx`.

## 4. Sitemap

En `src/routes/sitemap[.]xml.tsx`, además de los posts se itera `listPublicSedes()` (con `try/catch` como los posts) y se agrega una entrada por sede: `https://kingpapa.co/sedes/{slug}`, `changefreq weekly`, `priority 0.8`.

## Notas técnicas

- Nada de cambios de esquema: se usa la columna `slug` existente.
- La ruta se sirve con SSR, así que el HTML que ve Google ya trae H1, dirección y JSON-LD.
- Google puede tardar días en indexar las nuevas URLs; conviene republicar y pedir indexación en Search Console tras el despliegue.
