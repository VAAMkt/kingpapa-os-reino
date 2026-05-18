# Migración del blog KINGPAPA → /historias

Trasladar las **24 entradas** del JSON (`blog_kingpapa_24_entradas.txt`) a la sección **Historias** del KINGPAPA OS, respetando imágenes originales (descargadas localmente) y aplicando el diseño neo-brutalista existente.

## 1. Script de ingesta (one-shot, no se versiona)

Script Python en `/tmp/ingest_blog.py` que:

1. Lee `/tmp/blog.json` (24 posts).
2. Para cada post:
   - Extrae `id`, `slug`, `date`, `title.rendered`, `excerpt.rendered`, `content.rendered`, `featured_media`.
   - Limpia HTML del excerpt → texto plano (~200 chars).
   - **Imagen destacada**:
     - Primero intenta extraer el primer `<img src>` del `content.rendered`.
     - Si no hay, hace `GET https://kingpapacali.com/wp-json/wp/v2/media/{featured_media}` y toma `source_url`.
     - Descarga la imagen a `src/assets/blog/{slug}.jpg` (convirtiendo PNG/WebP → JPG con Pillow, max 1200px, calidad 82 para mantener bundle bajo).
   - **Imágenes inline del contenido**: descarga todas, las guarda en `src/assets/blog/{slug}/{n}.jpg` y reescribe los `src=` del HTML para apuntar a las rutas locales (`/src/assets/blog/...` resueltas vía import map o copia a `public/blog/...` — ver decisión técnica abajo).
   - **Asigna categoría** (`CategoriaHistoria`) heurísticamente a partir de palabras clave en título/contenido: "reto"→Retos, "fest"/"festival"→Festivales, "sede"/"abrimos"/"mallplaza"→Nuevas sedes, "franquicia"→Franquicias, "fan"/"súbdito"→Fans, default→Cultura interna.
3. Genera `src/data/historias.ts` con:
   - Array tipado `historias: Historia[]` (mismos campos actuales) + `contenidoHtml: string` nuevo.
   - Imports estáticos de las imágenes (`import img_{slug} from "@/assets/blog/{slug}.jpg"`).
   - Ordenado por `date` descendente.

**Decisión técnica imágenes inline**: para evitar 100+ imports y mantener simple el render del HTML embebido, guardo imágenes inline en `public/blog/{slug}/{n}.ext` (servidas como `/blog/{slug}/{n}.ext`). La portada (la que se muestra en el card) sí va a `src/assets/blog/{slug}.jpg` para bundling/optimización.

## 2. Cambios de tipos (`src/types/kp.ts`)

Añadir a `Historia`:

```ts
export interface Historia {
  // ... existentes
  contenidoHtml?: string;  // HTML completo del post (sanitizado, imgs reescritas a rutas locales)
  link?: string;           // URL original como referencia
}
```

## 3. Página de detalle: `src/routes/historias.$slug.tsx`

Nueva ruta dinámica con:
- `loader` que busca la historia por `slug` en `historias`; si no existe, `notFound()`.
- `head()` con `title`, `description` (excerpt), `og:title`, `og:description`, `og:image` (URL absoluta de la portada).
- Layout: hero con la imagen destacada + título + categoría + fecha; contenido renderizado con `dangerouslySetInnerHTML` dentro de un contenedor `prose`-like estilizado con tokens KP (titulares Bebas Neue, body Montserrat, links amarillo/morado).
- Estilos para `figure`, `img` (border-2 + shadow-brutal), `blockquote`, `h2/h3`, listas — definidos como clase `.kp-prose` en `src/styles.css`.
- Botón "Volver a Historias" + sección "Más historias del Reino" (3 cards aleatorios de la misma categoría).
- `errorComponent` + `notFoundComponent` propios.

## 4. Ajustes en `src/routes/historias.tsx` (listado)

- Mantener filtros por categoría.
- `EventCard` actualizado (`src/components/kp/Cards.tsx`):
  - El botón "Leer historia" pasa de placeholder a `<Link to="/historias/$slug" params={{ slug: h.slug }}>`.
  - Requiere añadir `slug: string` a `Historia` (ya viene del JSON).
- Quitar `videoUrl` si no aplica para estos posts (queda opcional).
- Mostrar fecha en formato consistente (evita el hydration mismatch actual: usar `toLocaleDateString("es-CO", { month: "short", year: "numeric", timeZone: "UTC" })`).

## 5. Limpieza

- Borrar mocks anteriores de `historias` y assets ya no usados (`share-platter.jpg`, etc. solo si no se referencian en otras rutas — verificar con `rg`).
- Añadir `src/assets/blog/` a la estructura.

## 6. Fuera de alcance

- No se implementa búsqueda full-text del blog (solo filtro por categoría).
- No se importan comentarios ni autores.
- No se conecta a Lovable Cloud (todo sigue como data estática tipada).

## Detalles técnicos

- **Stack**: TanStack Start file-based routing → `historias.$slug.tsx` se registra automáticamente.
- **Sanitización**: el HTML viene de WP propio (confiable). Aun así, se elimina `<script>`/`<style>` con regex en el script de ingesta antes de guardarlo en `contenidoHtml`.
- **Bundle**: ~24 imágenes portada en `src/assets/blog/` (~50–120 KB c/u tras recompresión) + N imágenes inline en `public/blog/` (servidas tal cual).
- **Hydration fix**: el `toLocaleDateString` actual produce "sept" en servidor y "ago" en cliente por diferencia de locale/timezone. Forzar `timeZone: "UTC"` y un locale fijo lo resuelve.
- **Comando de ingesta**: se ejecuta una sola vez en la fase de implementación; el output (`historias.ts` + assets) es lo que queda versionado.

Al aprobar, ejecuto el script, descargo todas las imágenes, genero el data file, creo la ruta de detalle y entrego /historias funcional con las 24 entradas reales.