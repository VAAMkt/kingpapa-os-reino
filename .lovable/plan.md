# Performance de imágenes: hero de la home + portadas de blog

## Hallazgo importante sobre el pipeline de assets

Probé el CDN (`/__l5e/assets-v1/...`) con parámetros de transformación:

- `?width=480`, `?w=480&format=webp`, `?format=webp` → todas devuelven **el mismo JPEG original** (`content-type: image/jpeg`, sin redimensionar).

**Limitación confirmada: el pipeline `__l5e/assets-v1` es almacenamiento inmutable puro.** No hace resize, ni negociación de formato (WebP/AVIF), ni acepta parámetros de URL. Un `srcset` con query params no serviría de nada: bajaría 3 veces el mismo archivo de 373 KB.

La ruta viable es **generar las variantes en build/local y subir cada variante como su propio asset** con la CLI (automático, sin resubida manual del usuario).

## Qué haré

### 1. Hero de la home (`src/routes/index.tsx`)

- Añadir `fetchPriority="high"` y `loading="eager"` explícitos al `<img>` del hero (hoy tiene `fetchPriority` pero no `loading`).
- Generar localmente desde el JPEG original variantes **AVIF y WebP** en 480w, 768w y 1280w (6 archivos), subirlas con `lovable-assets create` y escribir sus `.asset.json`.
- Reemplazar el `<img>` por un `<picture>` con `<source type="image/avif" srcset=...>`, `<source type="image/webp" srcset=...>` y el JPEG actual como fallback, con `sizes="(min-width: 768px) 50vw, 100vw"` (el hero es media columna en desktop, ancho completo en móvil).
- Actualizar el `rel="preload"` del `head()` para que apunte a la variante correcta usando `imagesrcset`/`imagesizes`, así el preload no descarga el JPEG grande en móvil.

Ahorro esperado: de ~373 KB a ~40-70 KB en móvil (AVIF 480w) y ~120-160 KB en desktop.

### 2. Portadas de blog (`src/assets/blog/`, 18 archivos JPEG, 3.3 MB)

Estas **no** están en el CDN: son archivos locales importados por el bundler en `src/data/historias.ts`. Eso permite optimizarlas sin resubida manual:

- Instalar `vite-imagetools` y registrarlo en `vite.config.ts`.
- No es necesario tocar los 18 imports uno por uno con sufijos de query: crearé un pequeño helper de portada que genere las variantes con `import.meta.glob` (`?format=avif;webp&w=480;768&as=picture`) y las use en la tarjeta de blog, cayendo al JPEG original si no hay variante.

Nota: `src/data/historias.ts` está marcado como deprecado (solo admin/dashboard); las portadas públicas vienen de la base de datos vía `posts.imagen_url`. Las imágenes subidas por el admin al bucket `blog-images` **quedan fuera de este cambio** (mismo límite de CDN sin transformación) — te lo señalo como pendiente, no lo fuerzo.

### 3. Verificación

- Build de producción y comparación del peso descargado del hero en móvil vs. desktop.
- Confirmar que el LCP sigue siendo el hero y que no cambia el layout.

## Fuera de alcance

Carrito, menú, checkout y cualquier lógica de negocio quedan intactos.
