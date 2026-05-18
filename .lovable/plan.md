# Arreglo y mejora del módulo de Contenidos

## Diagnóstico

**1. "Editar" y "+ Nueva historia" no hacen nada (causa raíz exacta):**
`src/routes/admin.contenidos.tsx` es la ruta padre de `admin.contenidos.nuevo` y `admin.contenidos.$id`, pero **renderiza directamente la lista `<ContenidosList />` sin `<Outlet />`**. En TanStack Router, cuando una ruta tiene hijas, el padre **debe** renderizar `<Outlet />` o la hija nunca aparece en pantalla (aunque la URL cambie). Por eso al hacer click en "Editar" o "+ Nueva historia" la URL cambia a `/admin/contenidos/nuevo` o `/admin/contenidos/:id` pero seguís viendo la lista.

**2. Carga muy lenta:**
- Cada ruta admin monta `useAuth()` de forma independiente, y cada montaje vuelve a llamar `getSession()` + `select` en `user_roles`. Al navegar entre `/admin`, `/admin/contenidos`, `/admin/usuarios` se rehace todo y la pantalla "Verificando corona…" parpadea varios segundos.
- `listAllPosts()` se vuelve a ejecutar sin cache compartido cuando se vuelve al listado.
- No hay `staleTime` configurado en las queries → refetch agresivo en cada focus.

**3. El módulo de contenidos hoy es básico para SEO:** no hay metadatos por post, ni open graph, ni JSON-LD Article, ni sitemap, ni canonical, ni control de keywords/descripción específica.

---

## Cambios propuestos

### A. Arreglo crítico de routing (resuelve #2 y #3)

Convertir `admin.contenidos` en **layout puro** y mover la tabla a un `index`:

```
src/routes/admin.contenidos.tsx        → layout: renderiza <Outlet />
src/routes/admin.contenidos.index.tsx  → NUEVO: la tabla actual (ContenidosList)
src/routes/admin.contenidos.nuevo.tsx  → ya existe, ahora sí se monta
src/routes/admin.contenidos.$id.tsx    → ya existe, ahora sí se monta
```

El layout incluye un mini-header con breadcrumb ("Contenidos / Nueva", "Contenidos / Editar") y botón "← Volver al listado" cuando estamos en hijos.

### B. Performance del admin

- **Cachear roles y sesión**: mover el resultado de `user_roles` a React Query con `queryKey: ["auth-roles", userId]` y `staleTime: 5 min`. `useAuth` consume la query → ninguna re-consulta al navegar entre rutas admin.
- **`staleTime` en queries del admin**: `["posts","all"]` con `staleTime: 30s` y `gcTime: 5min` → al volver al listado desde "Editar" aparece instantáneo.
- **Pantalla "Verificando corona…"**: mostrarla solo en la primera carga (cuando `user === null && loading`), no en cada navegación. Si ya hay `user` cacheado, render inmediato.
- **Prefetch del post al hover**: en la tabla, `onMouseEnter` en "Editar" hace `queryClient.prefetchQuery(["posts","byId",id])`. El click siguiente abre instantáneo.

### C. Funcionalidad faltante en el editor (PostForm)

- **Editor enriquecido**: reemplazar el `<textarea>` HTML crudo por un editor TipTap (negritas, listas, h2/h3, enlaces, blockquote, inserción de imagen desde el bucket). Sigue guardando HTML en `contenido_html`.
- **Subida múltiple de imágenes inline** al bucket `blog-images` desde el editor, con URL pública directa.
- **Vista previa** (toggle) que renderiza el HTML con la misma tipografía del frontend público.
- **Autosave borrador en localStorage** mientras se edita una historia nueva (no se pierde si cierra la pestaña).
- **Validación visual** de slug único antes de guardar (consulta `select id from posts where slug = ?`).
- **Duplicar historia** y **"Programar publicación"** (toggle + fecha futura, se respeta en `listPublicPosts` filtrando `fecha <= today`).

### D. SEO de las historias (lo más valioso para el negocio)

Cambios en BD (migración):
- Añadir a `posts`: `meta_titulo text`, `meta_descripcion text`, `og_image_url text`, `keywords text[]`, `tiempo_lectura_min int`, `actualizado_en date`.
- Índices: `idx_posts_publicado_fecha`, `idx_posts_slug`.

Cambios en frontend público (`/historias` y `/historias/$slug`):
- `head()` por ruta con `<title>` < 60 chars, `meta description` < 160, `og:title`, `og:description`, `og:image` (= `og_image_url ?? imagen_url`), `twitter:card`, `canonical`.
- **JSON-LD `Article`** inyectado por post (headline, datePublished, dateModified, author, image, mainEntityOfPage).
- **JSON-LD `BreadcrumbList`** Home → Historias → Categoría → Título.
- **`/historias`**: `head` con title/description propios; lista con `<article>` semánticos, `<h2>` por tarjeta, `loading="lazy"` y `width/height` explícitos en `<img>`.
- **`<h1>` único** por página de historia, jerarquía correcta.
- **`/sitemap.xml`** generado dinámicamente en `src/routes/api/public/sitemap.xml.tsx` con todos los posts publicados + rutas estáticas.
- **`/robots.txt`** que apunte al sitemap.
- **Alt automático** en imágenes (default al título si vacío) y warning visual en el form si falta.
- **Contador de caracteres** en meta_titulo/meta_descripcion con verde/ámbar/rojo según rango óptimo.

### E. Limpieza menor

- Botones "Despublicar / Eliminar" pasan a `<BrutalButton variant="ghost" size="sm">` para mejor accesibilidad (hoy son `<button>` sin estilos).
- Confirmación de borrado con dialog en vez de `window.confirm`.
- Toast de éxito con link "Ver historia" tras crear.

---

## Detalle técnico (resumen)

- Migración SQL: `ALTER TABLE posts ADD COLUMN ...` (6 columnas), 2 índices.
- Nuevos archivos: `src/routes/admin.contenidos.index.tsx`, `src/routes/api/public/sitemap.xml.tsx`, `src/routes/api/public/robots.txt.tsx`, `src/components/admin/RichEditor.tsx`, `src/components/seo/ArticleJsonLd.tsx`.
- Modificados: `src/routes/admin.contenidos.tsx` (→ layout con Outlet), `src/components/admin/PostForm.tsx` (campos SEO + RichEditor), `src/routes/historias.$slug.tsx` (head + JSON-LD), `src/routes/historias.tsx` (head + semántica), `src/hooks/useAuth.ts` (roles vía React Query), `src/lib/posts.ts` (filtro por fecha de publicación).
- Dependencia nueva: `@tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-image`.

## Validación

1. Click en "Editar" → abre `PostForm` con datos cargados, se puede cambiar imagen/texto y guardar.
2. Click en "+ Nueva historia" → muestra el formulario vacío y crea correctamente.
3. Navegar entre `/admin`, `/admin/contenidos`, `/admin/usuarios` no muestra "Verificando corona…" después de la primera carga.
4. `view-source:/historias/<slug>` muestra title, meta description, og:image y `<script type="application/ld+json">` con Article.
5. `/sitemap.xml` lista todos los posts publicados.
