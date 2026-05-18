# Fase 2 — CMS de Historias

Mueve `historias` de archivo estático a la base de datos, monta CRUD en `/admin/contenidos` y hace que `/historias` + `/historias/$slug` lean desde DB.

## 1. Base de datos

Migración nueva con tabla `posts`:

```text
posts
  id uuid PK default gen_random_uuid()
  slug text UNIQUE NOT NULL
  titulo text NOT NULL
  categoria text NOT NULL                 -- CategoriaHistoria
  extracto text NOT NULL
  contenido_html text                     -- HTML completo
  imagen_url text NOT NULL                -- URL pública (cover)
  video_url text
  link_original text                      -- URL kingpapacali.com (legacy)
  fecha date NOT NULL                     -- fecha de publicación
  publicado boolean NOT NULL default true
  autor_id uuid                           -- auth.users(id), nullable para seed
  created_at, updated_at timestamptz
  + índice (publicado, fecha desc), (slug)
```

RLS:
- SELECT público de filas `publicado = true` (rol `anon` y `authenticated`).
- INSERT/UPDATE/DELETE solo para `super_admin` o `editor` (vía `has_role`).
- Trigger `set_updated_at` reutilizando función existente.

## 2. Imágenes

- Copiar `src/assets/blog/*.jpg` → `public/blog-covers/*.jpg` (script `/tmp`).
- Crear bucket público `blog-images` para uploads del CMS desde el admin.
- En seed se usa `/blog-covers/<slug>.jpg`; en nuevos posts se usa la URL de Storage.

## 3. Seed inicial

Script TS que lee `src/data/historias.ts` y, para cada item, `INSERT INTO posts (...) ON CONFLICT (slug) DO NOTHING` con `imagen_url = '/blog-covers/<slug>.jpg'`. Se ejecuta via `supabase--insert`.

## 4. Capa de datos (frontend)

`src/lib/posts.functions.ts` — server functions:
- `listPostsPublicos()` — SELECT publicado=true, ordena por fecha desc. Sin auth (usa `client.ts`).
- `getPostPublicoBySlug(slug)` — uno.
- `listAllPosts()` (admin) con `requireSupabaseAuth` + check de rol.
- `upsertPost(input)`, `deletePost(id)` con `requireSupabaseAuth` + check rol.

Las rutas públicas usan `useQuery` (no loaders, para no romper SSR sin sesión).

## 5. /historias y /historias/$slug

Reescribir para consumir `useQuery(listPostsPublicos)` y `getPostPublicoBySlug`. Se mantienen los componentes existentes (`HistoriaCard`, layout).

`src/data/historias.ts` queda como fallback de tipos pero ya no se importa en runtime.

## 6. /admin/contenidos

Nuevas rutas:
- `src/routes/admin.contenidos.tsx` — listado: tabla con título, slug, categoría, fecha, publicado, acciones (editar, eliminar, ver). Botón "Nuevo post".
- `src/routes/admin.contenidos.nuevo.tsx` — formulario crear.
- `src/routes/admin.contenidos.$id.tsx` — formulario editar.

Formulario `PostForm.tsx`:
- Campos: título, slug (auto-generado desde título), categoría (select), extracto (textarea), contenido HTML (textarea grande, fase 2 sin WYSIWYG), fecha, publicado, cover (upload a bucket `blog-images` o URL manual), video URL opcional.
- Validación Zod en cliente + server.

Actualizar `admin.tsx` sidebar: link "Contenidos" deja de ser `soon`, apunta a `/admin/contenidos`.

## 7. Out of scope (fase 3+)

- WYSIWYG / editor rich text (Markdown plano por ahora; HTML del seed se preserva tal cual).
- CRUD de menú/sedes (siguiente fase del CMS).
- Versiones/drafts/preview.

## Detalles técnicos

- Server fns van en `src/lib/posts.functions.ts` (cliente-importable) + helpers en `posts.server.ts` si hace falta.
- Para checks de rol en server: SELECT a `user_roles` con el cliente autenticado (RLS deja ver los propios) o helper `assertHasRole(supabase, userId, roles[])` con `supabaseAdmin`.
- Tipado: `PostRow` derivado de `Database['public']['Tables']['posts']['Row']`.
- `slug` se valida con regex `/^[a-z0-9-]+$/`.

## Criterios de aceptación

1. Tabla `posts` con RLS correcta; lectura pública solo de publicados.
2. Seed con todas las historias actuales visibles en `/historias` desde DB.
3. `/admin/contenidos` (solo `super_admin`/`editor`): lista, crea, edita, elimina, despublica.
4. Crear un post nuevo desde admin → aparece en `/historias` sin redeploy.
5. Sidebar `/admin` actualizado.
6. `/historias` y `/historias/$slug` no importan `historias.ts` en runtime.
